import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Search,
  Filter,
  Layers,
  FileCheck,
  RefreshCw,
  Hash,
  ChevronRight,
} from 'lucide-react';
import { regulationsApi } from '../services/regulationsApi';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, EmptyState } from '../components/common/AsyncState';

const TYPE_LABELS = {
  LAW: { label: 'Luật Nhà nước', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  CIRCULAR: { label: 'Thông tư Bộ GD&ĐT', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  UNIVERSITY_REGULATION: { label: 'Quy chế Trường LHU', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  DECISION: { label: 'Quyết định', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  GUIDELINE: { label: 'Hướng dẫn / Mô phỏng', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
};

const STATUS_LABELS = {
  CONFIRMED_LHU_POLICY: { label: 'Chính sách LHU chính thức', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: ShieldCheck },
  INTERNAL_CRITERIA_UNCONFIRMED: { label: 'Chờ Hội đồng duyệt', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: Clock },
  SIMULATION_ONLY: { label: 'Mô phỏng Demo W1-P4', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300', icon: AlertTriangle },
  REJECTED: { label: 'Không áp dụng', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', icon: AlertTriangle },
};

export default function Regulations() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'chunks' | 'criteria'
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [filterCriteriaConfirmed, setFilterCriteriaConfirmed] = useState('ALL');
  const [searchChunk, setSearchChunk] = useState('');

  // Modal states
  const [showDocModal, setShowDocModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [docFormData, setDocFormData] = useState({
    documentCode: '',
    title: '',
    issuingAuthority: '',
    documentType: 'UNIVERSITY_REGULATION',
    description: '',
  });
  const [versionFormData, setVersionFormData] = useState({
    versionNumber: '',
    effectiveFrom: '',
    effectiveTo: '',
    sourceUrl: '',
    contentForHash: '',
  });

  const isManagerOrAdmin = (user?.roles || []).some((r) => {
    const code = typeof r === 'string' ? r : r.code || r.role_code;
    return ['ADMIN', 'SYSTEM_ADMIN', 'COUNCIL', 'MANAGER'].includes(code);
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, critRes] = await Promise.all([
        regulationsApi.listDocuments(),
        regulationsApi.listCriteria({ confirmedOnly: false }),
      ]);
      setDocuments(docsRes.data || []);
      setCriteria(critRes.data || []);

      if (docsRes.data && docsRes.data.length > 0 && !selectedDoc) {
        setSelectedDoc(docsRes.data[0]);
      }
    } catch (err) {
      setError(err.message || 'Không thể tải danh mục văn bản quy chế');
    } finally {
      setLoading(false);
    }
  }, [selectedDoc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load versions and chunks when selectedDoc changes
  useEffect(() => {
    if (selectedDoc?.document_id) {
      regulationsApi.getDocumentById(selectedDoc.document_id).then((res) => {
        const fullDoc = res.data;
        setSelectedDoc(fullDoc);
        if (fullDoc.versions && fullDoc.versions.length > 0) {
          const firstVer = fullDoc.versions[0];
          setSelectedVersion(firstVer);
          loadChunks(firstVer.version_id);
        } else {
          setSelectedVersion(null);
          setChunks([]);
        }
      });
    }
  }, [selectedDoc?.document_id]);

  const loadChunks = async (versionId) => {
    try {
      const res = await regulationsApi.getChunks(versionId);
      setChunks(res.data || []);
    } catch {
      setChunks([]);
    }
  };

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleConfirmVersion = async (versionId, isConfirmed, currentStatus) => {
    try {
      const newStatus = isConfirmed ? 'CONFIRMED_LHU_POLICY' : 'INTERNAL_CRITERIA_UNCONFIRMED';
      await regulationsApi.confirmVersion(versionId, {
        isConfirmed,
        lhuApplicationStatus: newStatus,
        confirmationNotes: isConfirmed ? 'Phê duyệt chính thức áp dụng tại Trường Đại học Lạc Hồng' : 'Hủy phê duyệt',
      });
      fetchData();
      if (selectedDoc?.document_id) {
        const res = await regulationsApi.getDocumentById(selectedDoc.document_id);
        setSelectedDoc(res.data);
      }
    } catch (err) {
      alert(err.message || 'Lỗi thao tác phê duyệt phiên bản');
    }
  };

  const handleConfirmCriteria = async (criterionId, isConfirmed) => {
    try {
      await regulationsApi.confirmCriteria(criterionId, {
        isConfirmed,
        notes: isConfirmed ? 'Xác nhận áp dụng tiêu chuẩn cho Hội đồng và Đánh giá' : 'Đưa về bản nháp chưa xác nhận',
      });
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi thao tác phê duyệt tiêu chí');
    }
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      await regulationsApi.createDocument(docFormData);
      setShowDocModal(false);
      setDocFormData({
        documentCode: '',
        title: '',
        issuingAuthority: '',
        documentType: 'UNIVERSITY_REGULATION',
        description: '',
      });
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi tạo văn bản quy chế');
    }
  };

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    if (!selectedDoc) return;
    try {
      await regulationsApi.createVersion(selectedDoc.document_id, {
        ...versionFormData,
        supersedesVersionId: selectedVersion?.version_id || null,
        effectiveTo: versionFormData.effectiveTo || null,
        sourceUrl: versionFormData.sourceUrl || null,
      });
      setShowVersionModal(false);
      setVersionFormData({
        versionNumber: '',
        effectiveFrom: '',
        effectiveTo: '',
        sourceUrl: '',
        contentForHash: '',
      });
      const res = await regulationsApi.getDocumentById(selectedDoc.document_id);
      setSelectedDoc(res.data);
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi tạo phiên bản quy chế mới');
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (filterType !== 'ALL' && d.document_type !== filterType) return false;
    return true;
  });

  const filteredChunks = chunks.filter((c) => {
    if (!searchChunk) return true;
    const q = searchChunk.toLowerCase();
    return (
      (c.article_no && c.article_no.toLowerCase().includes(q)) ||
      (c.clause_no && c.clause_no.toLowerCase().includes(q)) ||
      c.content.toLowerCase().includes(q)
    );
  });

  const filteredCriteria = criteria.filter((c) => {
    if (filterCriteriaConfirmed === 'CONFIRMED' && !c.is_confirmed) return false;
    if (filterCriteriaConfirmed === 'UNCONFIRMED' && c.is_confirmed) return false;
    return true;
  });

  if (loading && documents.length === 0) {
    return (
      <div className="p-6">
        <LoadingState message="Đang tải kho văn bản và tiêu chí quy định..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl dark:bg-blue-500/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Kho Văn bản Quy định & Tiêu chí Khen thưởng
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Quản lý các nguồn pháp lý gốc (Luật 06, Thông tư 07, Quy chế LHU), truy xuất đoạn trích dẫn (Chunks) và kiểm soát bộ tiêu chí xét thưởng
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              onClick={() => setShowDocModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm Văn bản mới
            </button>
          )}
          <button
            onClick={fetchData}
            className="p-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Nguyên tắc kiểm soát Tiêu chuẩn & Thẩm quyền (Fail-closed):</p>
          <p>
            Chỉ những phiên bản văn bản và tiêu chí được Hội đồng LHU thẩm định phê duyệt chính thức (<code>is_confirmed = true</code>) mới được cấp phép cho bộ phân tích AI và quy trình xét khen thưởng. Mọi dữ liệu mô phỏng đều được cô lập và gắn nhãn cảnh báo rõ ràng.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-3 text-sm font-medium transition relative flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          Văn bản & Phiên bản ({documents.length})
        </button>

        <button
          onClick={() => setActiveTab('chunks')}
          className={`pb-3 text-sm font-medium transition relative flex items-center gap-2 ${
            activeTab === 'chunks'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          Trích đoạn Tra cứu (Chunks)
        </button>

        <button
          onClick={() => setActiveTab('criteria')}
          className={`pb-3 text-sm font-medium transition relative flex items-center gap-2 ${
            activeTab === 'criteria'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Tiêu chí Khen thưởng ({criteria.length})
        </button>
      </div>

      {/* TAB 1: Documents & Versions */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Danh sách văn bản */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">
                Danh mục Văn bản
              </h3>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">Tất cả loại</option>
                <option value="LAW">Luật</option>
                <option value="CIRCULAR">Thông tư</option>
                <option value="UNIVERSITY_REGULATION">Quy chế LHU</option>
                <option value="GUIDELINE">Mô phỏng/Hướng dẫn</option>
              </select>
            </div>

            <div className="space-y-2">
              {filteredDocs.map((doc) => {
                const isSelected = selectedDoc?.document_id === doc.document_id;
                const typeInfo = TYPE_LABELS[doc.document_type] || TYPE_LABELS.GUIDELINE;
                return (
                  <div
                    key={doc.document_id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                        {doc.document_code}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 mb-2">
                      {doc.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                      Ban hành: {doc.issuing_authority || 'Chưa cập nhật'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{doc.versions_count || 1} phiên bản</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cột phải: Chi tiết Văn bản & Danh sách Phiên bản (Versions) */}
          <div className="lg:col-span-2 space-y-6">
            {selectedDoc ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="font-mono text-sm px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold">
                      {selectedDoc.document_code}
                    </span>
                    {isManagerOrAdmin && (
                      <button
                        onClick={() => setShowVersionModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded-lg hover:bg-blue-100 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ban hành Phiên bản mới
                      </button>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {selectedDoc.title}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedDoc.description || 'Chưa có mô tả chi tiết'}
                  </p>
                </div>

                {/* Danh sách các phiên bản */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
                    Lịch sử Phiên bản (Bất biến & Quan hệ Thay thế)
                  </h3>
                  <div className="space-y-4">
                    {(selectedDoc.versions || []).map((ver) => {
                      const statusInfo = STATUS_LABELS[ver.lhu_application_status] || STATUS_LABELS.INTERNAL_CRITERIA_UNCONFIRMED;
                      const StatusIcon = statusInfo.icon;
                      return (
                        <div
                          key={ver.version_id}
                          className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/20"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-base">
                                Phiên bản: {ver.version_number}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusInfo.label}
                              </span>
                            </div>

                            {/* Quyền duyệt của Hội đồng */}
                            {isManagerOrAdmin && (
                              <div className="flex items-center gap-2">
                                {!ver.is_confirmed ? (
                                  <button
                                    onClick={() => handleConfirmVersion(ver.version_id, true, ver.lhu_application_status)}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition"
                                  >
                                    Phê duyệt áp dụng LHU
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleConfirmVersion(ver.version_id, false, ver.lhu_application_status)}
                                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs transition"
                                  >
                                    Hủy phê duyệt
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Metadata version */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="text-slate-400">Hiệu lực từ:</span>{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">{ver.effective_from_str || ver.effective_from}</span>
                              {ver.effective_to_str && (
                                <>
                                  {' '}- <span className="text-slate-400">Đến:</span>{' '}
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{ver.effective_to_str}</span>
                                </>
                              )}
                            </div>
                            {ver.supersedes_version_number && (
                              <div>
                                <span className="text-slate-400">Thay thế phiên bản:</span>{' '}
                                <span className="font-semibold text-blue-600">{ver.supersedes_version_number}</span>
                              </div>
                            )}
                          </div>

                          {/* SHA-256 Hash */}
                          <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono">
                            <div className="flex items-center gap-1.5 overflow-hidden text-slate-500">
                              <Hash className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                              <span className="truncate" title={ver.sha256_hash}>
                                SHA-256: {ver.sha256_hash}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCopyHash(ver.sha256_hash)}
                              className="text-slate-400 hover:text-blue-600 flex-shrink-0 p-1"
                              title="Sao chép mã băm SHA-256"
                            >
                              {copiedHash === ver.sha256_hash ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Link nguồn chính thức */}
                          {ver.source_url && (
                            <div className="text-xs">
                              <a
                                href={ver.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Xem tài liệu công bố chính thức / File PDF gốc
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState message="Vui lòng chọn một văn bản quy định để xem chi tiết" />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Chunks Viewer */}
      {activeTab === 'chunks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Xem trích đoạn của văn bản:
              </span>
              <select
                value={selectedDoc?.document_id || ''}
                onChange={(e) => {
                  const doc = documents.find((d) => d.document_id === Number(e.target.value));
                  setSelectedDoc(doc);
                }}
                className="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                {documents.map((d) => (
                  <option key={d.document_id} value={d.document_id}>
                    {d.document_code} - {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo Điều, Khoản, Nội dung..."
                value={searchChunk}
                onChange={(e) => setSearchChunk(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredChunks.length === 0 ? (
              <EmptyState message="Không tìm thấy trích đoạn phù hợp" />
            ) : (
              filteredChunks.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 border-b pb-2 border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 font-semibold text-blue-600 dark:text-blue-400">
                      {chunk.article_no && <span>{chunk.article_no}</span>}
                      {chunk.clause_no && <span>{chunk.clause_no}</span>}
                      {chunk.page_no && <span className="text-slate-400">Trang {chunk.page_no}</span>}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      Hash: {chunk.chunk_hash.substring(0, 16)}...
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {chunk.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Award Criteria */}
      {activeTab === 'criteria' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">Lọc theo duyệt:</span>
              <select
                value={filterCriteriaConfirmed}
                onChange={(e) => setFilterCriteriaConfirmed(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Tất cả ({criteria.length})</option>
                <option value="CONFIRMED">Đã xác nhận chính thức</option>
                <option value="UNCONFIRMED">Chưa duyệt / Mô phỏng</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Mã Tiêu chí</th>
                  <th className="px-4 py-3">Mục tiêu & Tên tiêu chuẩn</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Ngưỡng / Đơn vị</th>
                  <th className="px-4 py-3">Căn cứ Pháp lý</th>
                  <th className="px-4 py-3">Trạng thái Duyệt</th>
                  {isManagerOrAdmin && <th className="px-4 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCriteria.map((c) => (
                  <tr key={c.criteria_version_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-4 py-3 font-mono font-bold text-xs text-blue-600">
                      {c.criterion_code}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                      {c.notes && <div className="text-xs text-slate-400 mt-0.5">{c.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium">
                        {c.target_type === 'INDIVIDUAL' ? 'Cá nhân' : c.target_type === 'COLLECTIVE' ? 'Tập thể' : 'Cả hai'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {c.min_threshold ?? '-'} {c.unit_metric || ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-xs">
                      {c.legal_references || 'Chưa liên kết'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.is_confirmed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã phê duyệt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          Chưa duyệt / Demo
                        </span>
                      )}
                    </td>
                    {isManagerOrAdmin && (
                      <td className="px-4 py-3 text-right">
                        {!c.is_confirmed ? (
                          <button
                            onClick={() => handleConfirmCriteria(c.criteria_version_id, true)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition"
                          >
                            Phê duyệt
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConfirmCriteria(c.criteria_version_id, false)}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs transition"
                          >
                            Bỏ duyệt
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Thêm Văn bản */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Thêm Văn bản Quy chế Mới
            </h3>
            <form onSubmit={handleCreateDocument} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Mã Văn bản *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: QD-LHU-2026-01"
                  value={docFormData.documentCode}
                  onChange={(e) => setDocFormData({ ...docFormData, documentCode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tên Tiêu đề Văn bản *</label>
                <input
                  type="text"
                  required
                  placeholder="Quy định tiêu chuẩn thi đua khen thưởng năm 2026..."
                  value={docFormData.title}
                  onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Cơ quan ban hành</label>
                <input
                  type="text"
                  placeholder="Hiệu trưởng Trường Đại học Lạc Hồng"
                  value={docFormData.issuingAuthority}
                  onChange={(e) => setDocFormData({ ...docFormData, issuingAuthority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Loại Văn bản *</label>
                <select
                  value={docFormData.documentType}
                  onChange={(e) => setDocFormData({ ...docFormData, documentType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="UNIVERSITY_REGULATION">Quy chế Nhà trường</option>
                  <option value="DECISION">Quyết định</option>
                  <option value="GUIDELINE">Hướng dẫn</option>
                  <option value="CIRCULAR">Thông tư</option>
                  <option value="LAW">Luật</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 dark:border-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Tạo Văn bản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Phiên bản */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Ban hành Phiên bản mới cho: {selectedDoc?.document_code}
            </h3>
            <form onSubmit={handleCreateVersion} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Số hiệu Phiên bản *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 2026.02 hoặc v2.0"
                  value={versionFormData.versionNumber}
                  onChange={(e) => setVersionFormData({ ...versionFormData, versionNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Hiệu lực từ *</label>
                  <input
                    type="date"
                    required
                    value={versionFormData.effectiveFrom}
                    onChange={(e) => setVersionFormData({ ...versionFormData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={versionFormData.effectiveTo}
                    onChange={(e) => setVersionFormData({ ...versionFormData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Đường dẫn tệp nguồn (URL)</label>
                <input
                  type="url"
                  placeholder="https://lhu.edu.vn/regulations/..."
                  value={versionFormData.sourceUrl}
                  onChange={(e) => setVersionFormData({ ...versionFormData, sourceUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Nội dung tóm tắt để băm SHA-256</label>
                <textarea
                  rows={3}
                  placeholder="Nội dung để hệ thống tự động tính mã băm toàn vẹn SHA-256..."
                  value={versionFormData.contentForHash}
                  onChange={(e) => setVersionFormData({ ...versionFormData, contentForHash: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 dark:border-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Ban hành Phiên bản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
