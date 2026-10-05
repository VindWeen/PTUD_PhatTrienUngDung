import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  User,
  Users,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  FileText,
  Download,
  UploadCloud,
  FileUp,
  Send,
  Check,
  RotateCcw,
  ShieldAlert,
  History,
  Layers,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { achievementsApi } from '../services/achievementsApi';
import { organizationsApi } from '../services/organizationsApi';
import { evidencesApi } from '../services/evidencesApi';
import { LoadingState, ErrorState, EmptyState } from '../components/common/AsyncState';

const STATUS_BADGES = {
  DRAFT: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  SUBMITTED: { label: 'Chờ duyệt', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  NEED_CORRECTION: { label: 'Cần bổ sung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  VERIFIED: { label: 'Đã xác nhận', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  REJECTED: { label: 'Từ chối', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  REVOKED: { label: 'Đã thu hồi', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

export default function Achievements() {
  const { user } = useAuth();
  const userRoles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const isManager = userRoles.includes('MANAGER');
  const isAdmin = userRoles.includes('ADMIN');
  const canReview = isManager || isAdmin;

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow Tabs: 'ALL' | 'PENDING' (W2-Q3: Hàng chờ thẩm định)
  const [activeTab, setActiveTab] = useState('ALL');

  // Filters
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Danh mục loại thành tích & đơn vị
  const [types, setTypes] = useState([]);
  const [units, setUnits] = useState([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [detailTab, setDetailTab] = useState('INFO'); // 'INFO' | 'HISTORIES' | 'SUBMISSIONS'
  const [isEditing, setIsEditing] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Evidence States (W2-Q2)
  const [evidences, setEvidences] = useState([]);
  const [evidencesLoading, setEvidencesLoading] = useState(false);
  const [evidenceFormOpen, setEvidenceFormOpen] = useState(false);
  const [evidenceFormData, setEvidenceFormData] = useState({ title: '', description: '', file: null });
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);

  // Status Histories & Submissions (W2-Q3)
  const [histories, setHistories] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Workflow Action Modal (W2-Q3)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState('SUBMIT'); // 'SUBMIT' | 'VERIFY' | 'REQUEST_CORRECTION' | 'REJECT' | 'CANCEL' | 'REVOKE'
  const [actionNote, setActionNote] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [targetAchievement, setTargetAchievement] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    subjectType: 'LECTURER',
    organizationUnitId: '',
    achievementTypeId: '',
    title: '',
    description: '',
    contributionRole: '',
    startDate: '',
    endDate: '',
    recognitionYear: new Date().getFullYear(),
    academicYearId: '',
    version: 1,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const effectiveStatus = activeTab === 'PENDING' ? 'SUBMITTED' : (statusFilter || undefined);
      const res = await achievementsApi.list({
        page: pagination.page,
        pageSize: pagination.pageSize,
        subjectType: subjectFilter || undefined,
        status: effectiveStatus,
        search: searchQuery || undefined,
        recognitionYear: yearFilter || undefined,
      });
      setItems(res.items || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, subjectFilter, statusFilter, searchQuery, yearFilter, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load danh mục loại thành tích và tổ chức
  useEffect(() => {
    async function fetchCatalogs() {
      try {
        const [typesData, unitsData] = await Promise.all([
          achievementsApi.listAchievementTypes().catch(() => []),
          organizationsApi.list().catch(() => []),
        ]);
        setTypes(Array.isArray(typesData) ? typesData : []);
        setUnits(Array.isArray(unitsData) ? unitsData : []);
      } catch (err) {
        console.error('Lỗi nạp danh mục:', err);
      }
    }
    fetchCatalogs();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setFormData({
      subjectType: 'LECTURER',
      organizationUnitId: units[0]?.unitId || '',
      achievementTypeId: types[0]?.achievement_type_id || '',
      title: '',
      description: '',
      contributionRole: '',
      startDate: '',
      endDate: '',
      recognitionYear: new Date().getFullYear(),
      academicYearId: '',
      version: 1,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (ach) => {
    setIsEditing(true);
    setSelectedAchievement(ach);
    setFormData({
      subjectType: ach.subjectType,
      organizationUnitId: ach.organizationUnitId || '',
      achievementTypeId: ach.achievementTypeId || '',
      title: ach.title || '',
      description: ach.description || '',
      contributionRole: ach.contributionRole || '',
      startDate: ach.startDate || '',
      endDate: ach.endDate || '',
      recognitionYear: ach.recognitionYear || new Date().getFullYear(),
      academicYearId: ach.academicYearId || '',
      version: ach.version,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const loadEvidences = useCallback(async (achievementId) => {
    if (!achievementId) return;
    setEvidencesLoading(true);
    setEvidenceError(null);
    try {
      const data = await evidencesApi.getEvidencesByAchievement(achievementId);
      setEvidences(data || []);
    } catch (err) {
      setEvidenceError(err.message || 'Không thể tải danh sách minh chứng');
    } finally {
      setEvidencesLoading(false);
    }
  }, []);

  const isSelf = (ach) => {
    if (!user || !ach) return false;
    const uid = user.userId || user.id;
    return (
      ach.createdByUserId === uid ||
      ach.profileUserId === uid ||
      ach.submittedByUserId === uid
    );
  };

  const loadHistoryAndSubmissions = async (achievementId) => {
    if (!achievementId) return;
    setHistoryLoading(true);
    try {
      const [histData, subData] = await Promise.all([
        achievementsApi.getHistory(achievementId).catch(() => []),
        achievementsApi.getSubmissions(achievementId).catch(() => []),
      ]);
      setHistories(Array.isArray(histData) ? histData : []);
      setSubmissions(Array.isArray(subData) ? subData : []);
    } catch (err) {
      console.error('Lỗi tải lịch sử / phiên bản:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openDetailModal = async (ach) => {
    try {
      setDetailTab('INFO');
      const detail = await achievementsApi.getById(ach.achievementId);
      setSelectedAchievement(detail);
      setDetailModalOpen(true);
      setEvidenceFormOpen(false);
      loadEvidences(detail.achievementId);
      loadHistoryAndSubmissions(detail.achievementId);
    } catch (err) {
      alert(`Không thể xem chi tiết: ${err.message}`);
    }
  };

  const openActionModal = (ach, type) => {
    setTargetAchievement(ach);
    setActionType(type);
    setActionNote('');
    setActionError(null);
    setActionModalOpen(true);
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!targetAchievement) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      const payload = { version: targetAchievement.version };
      if (['REQUEST_CORRECTION', 'REJECT', 'CANCEL', 'REVOKE'].includes(actionType)) {
        if (!actionNote.trim()) {
          throw new Error('Vui lòng nhập lý do thực hiện thao tác.');
        }
        payload.reason = actionNote.trim();
      } else if (actionType === 'SUBMIT') {
        payload.submitNote = actionNote.trim() || undefined;
      } else if (actionType === 'VERIFY') {
        payload.note = actionNote.trim() || undefined;
      }

      if (actionType === 'SUBMIT') {
        await achievementsApi.submit(targetAchievement.achievementId, payload);
      } else if (actionType === 'VERIFY') {
        await achievementsApi.verify(targetAchievement.achievementId, payload);
      } else if (actionType === 'REQUEST_CORRECTION') {
        await achievementsApi.requestCorrection(targetAchievement.achievementId, payload);
      } else if (actionType === 'REJECT') {
        await achievementsApi.reject(targetAchievement.achievementId, payload);
      } else if (actionType === 'CANCEL') {
        await achievementsApi.cancel(targetAchievement.achievementId, payload);
      } else if (actionType === 'REVOKE') {
        await achievementsApi.revoke(targetAchievement.achievementId, payload);
      }

      setActionModalOpen(false);
      await loadData();
      if (detailModalOpen && selectedAchievement?.achievementId === targetAchievement.achievementId) {
        const refreshed = await achievementsApi.getById(targetAchievement.achievementId);
        setSelectedAchievement(refreshed);
        loadHistoryAndSubmissions(targetAchievement.achievementId);
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Thao tác không thành công';
      setActionError(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCreateEvidence = async (e) => {
    e.preventDefault();
    if (!selectedAchievement || !evidenceFormData.file) {
      alert('Vui lòng chọn tệp tin minh chứng (PDF, JPG, PNG, DOCX <= 10MB)');
      return;
    }
    setEvidenceSubmitting(true);
    setEvidenceError(null);
    try {
      await evidencesApi.createEvidence(selectedAchievement.achievementId, evidenceFormData);
      setEvidenceFormOpen(false);
      setEvidenceFormData({ title: '', description: '', file: null });
      await loadEvidences(selectedAchievement.achievementId);
    } catch (err) {
      setEvidenceError(err.response?.data?.error?.message || err.message || 'Lỗi khi tải lên minh chứng');
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const handleUploadFileVersion = async (evidenceId, file) => {
    if (!file) return;
    try {
      await evidencesApi.uploadFileVersion(evidenceId, file);
      if (selectedAchievement) {
        await loadEvidences(selectedAchievement.achievementId);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Không thể tải lên phiên bản mới');
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa minh chứng này khỏi hồ sơ?')) return;
    try {
      await evidencesApi.deleteEvidence(evidenceId);
      if (selectedAchievement) {
        await loadEvidences(selectedAchievement.achievementId);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Không thể xóa minh chứng');
    }
  };

  const handleDownloadFile = async (fileId, fileName) => {
    try {
      await evidencesApi.downloadEvidenceFile(fileId, fileName);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Không thể tải về tệp tin này');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
        throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
      }

      if (isEditing && selectedAchievement) {
        await achievementsApi.update(selectedAchievement.achievementId, {
          title: formData.title,
          description: formData.description,
          contributionRole: formData.contributionRole,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          recognitionYear: Number(formData.recognitionYear),
          achievementTypeId: Number(formData.achievementTypeId),
          academicYearId: formData.academicYearId ? Number(formData.academicYearId) : null,
          version: formData.version,
        });
      } else {
        await achievementsApi.create({
          subjectType: formData.subjectType,
          organizationUnitId: formData.subjectType === 'UNIT' ? Number(formData.organizationUnitId) : null,
          achievementTypeId: Number(formData.achievementTypeId),
          title: formData.title,
          description: formData.description,
          contributionRole: formData.contributionRole,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          recognitionYear: Number(formData.recognitionYear),
          academicYearId: formData.academicYearId ? Number(formData.academicYearId) : null,
        });
      }

      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Thao tác không thành công.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (ach) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản nháp thành tích "${ach.title}" không?`)) {
      return;
    }
    try {
      await achievementsApi.remove(ach.achievementId);
      loadData();
    } catch (err) {
      alert(`Xóa thất bại: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Hồ sơ Thành tích Khoa học & Đào tạo
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Kê khai, theo dõi và quản lý thành tích cá nhân giảng viên và tập thể đơn vị
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#008080] hover:bg-[#006666] text-white font-medium text-sm transition shadow-soft-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Kê khai Thành tích</span>
        </button>
      </div>

      {/* Tab Navigation: Tất cả hồ sơ vs Hàng chờ thẩm định (W2-Q3) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-1">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
            activeTab === 'ALL'
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 font-semibold shadow-soft-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Tất cả thành tích</span>
        </button>
        {canReview && (
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'PENDING'
                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold shadow-soft-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Hàng chờ thẩm định</span>
          </button>
        )}
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề hoặc nội dung thành tích..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 dark:text-white"
          />
        </div>

        {/* Filter: Subject Type */}
        <div className="flex items-center gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">Tất cả chủ thể</option>
            <option value="LECTURER">Cá nhân (Giảng viên)</option>
            <option value="UNIT">Tập thể (Đơn vị)</option>
          </select>

          {/* Filter: Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp (DRAFT)</option>
            <option value="SUBMITTED">Chờ duyệt (SUBMITTED)</option>
            <option value="NEED_CORRECTION">Cần bổ sung (NEED_CORRECTION)</option>
            <option value="VERIFIED">Đã xác nhận (VERIFIED)</option>
            <option value="REJECTED">Từ chối (REJECTED)</option>
          </select>

          {/* Filter: Year */}
          <input
            type="number"
            placeholder="Năm"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-24 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          />

          <button
            onClick={loadData}
            title="Làm mới"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Danh sách Thành tích */}
      {loading ? (
        <LoadingState label="Đang tải danh sách thành tích..." />
      ) : error ? (
        <ErrorState error={error} onRetry={loadData} />
      ) : items.length === 0 ? (
        <EmptyState message="Không tìm thấy thành tích nào phù hợp với bộ lọc." />
      ) : (
        <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-soft-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-700/80">
                <tr>
                  <th className="px-6 py-4">Chủ thể & Tiêu đề</th>
                  <th className="px-6 py-4">Loại thành tích</th>
                  <th className="px-6 py-4">Đơn vị quản lý</th>
                  <th className="px-6 py-4">Năm</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                {items.map((ach) => {
                  const statusInfo = STATUS_BADGES[ach.status] || { label: ach.status, color: 'bg-slate-100 text-slate-700' };
                  const isPersonal = ach.subjectType === 'LECTURER';

                  return (
                    <tr
                      key={ach.achievementId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              isPersonal
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            {isPersonal ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                            {isPersonal ? 'Cá nhân' : 'Tập thể'}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                              {ach.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {ach.subjectName || (isPersonal ? 'Giảng viên' : 'Đơn vị')}
                              {ach.contributionRole ? ` • ${ach.contributionRole}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {ach.achievementTypeName || ach.achievementTypeCode || '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {ach.contextUnitName || `Unit #${ach.contextUnitId}`}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                        {ach.recognitionYear}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openDetailModal(ach)}
                            title="Xem chi tiết"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {['DRAFT', 'NEED_CORRECTION'].includes(ach.status) && (
                            <>
                              <button
                                onClick={() => openEditModal(ach)}
                                title="Chỉnh sửa bản nháp"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(ach, 'SUBMIT')}
                                title="Nộp thẩm định (Yêu cầu có ít nhất 1 minh chứng)"
                                className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {ach.status === 'SUBMITTED' && isSelf(ach) && (
                            <button
                              onClick={() => openActionModal(ach, 'CANCEL')}
                              title="Hủy yêu cầu nộp hồ sơ"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {ach.status === 'SUBMITTED' && canReview && !isSelf(ach) && (
                            <>
                              <button
                                onClick={() => openActionModal(ach, 'VERIFY')}
                                title="Xác nhận / Phê duyệt (VERIFY)"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(ach, 'REQUEST_CORRECTION')}
                                title="Yêu cầu bổ sung (NEED_CORRECTION)"
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openActionModal(ach, 'REJECT')}
                                title="Từ chối hồ sơ (REJECT)"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {ach.status === 'VERIFIED' && (
                            <span title="Đã xác nhận & Khóa nội dung (Immutability)" className="p-1 text-emerald-600">
                              <Lock className="w-4 h-4" />
                            </span>
                          )}
                          {ach.status === 'VERIFIED' && isAdmin && (
                            <button
                              onClick={() => openActionModal(ach, 'REVOKE')}
                              title="Thu hồi quyết định xác nhận (Admin)"
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          )}
                          {ach.status === 'DRAFT' && (
                            <button
                              onClick={() => handleDelete(ach)}
                              title="Xóa bản nháp"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Tổng số <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.total}</span> thành tích
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Trước
              </button>
              <span>
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Tạo mới / Sửa thành tích */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-soft-2xl border border-slate-200/80 dark:border-slate-700/80 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-teal-600" />
                <span>{isEditing ? 'Chỉnh sửa Bản nháp Thành tích' : 'Kê khai Thành tích Mới (Bản nháp)'}</span>
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4 text-sm">
              {/* Chủ thể: Cá nhân hoặc Tập thể */}
              {!isEditing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Chủ thể Kê khai <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, subjectType: 'LECTURER' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition ${
                        formData.subjectType === 'LECTURER'
                          ? 'border-teal-500 bg-teal-50/50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>Cá nhân Giảng viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, subjectType: 'UNIT' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition ${
                        formData.subjectType === 'UNIT'
                          ? 'border-teal-500 bg-teal-50/50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Tập thể Đơn vị</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Nếu là Tập thể: Chọn đơn vị */}
              {formData.subjectType === 'UNIT' && !isEditing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Đơn vị Tập thể đại diện <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.organizationUnitId}
                    onChange={(e) => setFormData({ ...formData, organizationUnitId: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  >
                    <option value="">-- Chọn đơn vị --</option>
                    {units.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Loại thành tích */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Loại Thành tích <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.achievementTypeId}
                  onChange={(e) => setFormData({ ...formData, achievementTypeId: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                >
                  <option value="">-- Chọn loại thành tích --</option>
                  {types.map((t) => (
                    <option key={t.achievement_type_id} value={t.achievement_type_id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên đề tài / bài báo / sáng kiến / thành tích <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  maxLength={255}
                  placeholder="Ví dụ: Ứng dụng Deep Learning trong phân tích dữ liệu lớn..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                />
              </div>

              {/* Vai trò đóng góp & Năm ghi nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Vai trò đóng góp
                  </label>
                  <input
                    type="text"
                    placeholder="Chủ nhiệm đề tài, Tác giả chính..."
                    value={formData.contributionRole}
                    onChange={(e) => setFormData({ ...formData, contributionRole: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Năm ghi nhận <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1990}
                    max={2100}
                    value={formData.recognitionYear}
                    onChange={(e) => setFormData({ ...formData, recognitionYear: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Thời gian thực hiện: Từ ngày -> Đến ngày */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ngày hoàn thành / nghiệm thu
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tóm tắt nội dung & Kết quả đạt được
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả tóm tắt giá trị khoa học, sản phẩm chuyển giao hoặc kết quả nghiệm thu..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {formSubmitting ? 'Đang lưu...' : isEditing ? 'Cập nhật bản nháp' : 'Lưu bản nháp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Chi tiết thành tích (W2-Q2 & W2-Q3) */}
      {detailModalOpen && selectedAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-soft-2xl border border-slate-200/80 dark:border-slate-700/80 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    STATUS_BADGES[selectedAchievement.status]?.color
                  }`}
                >
                  {STATUS_BADGES[selectedAchievement.status]?.label || selectedAchievement.status}
                </span>
                <span className="text-xs text-slate-500">Mã #{selectedAchievement.achievementId}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  v{selectedAchievement.version}
                </span>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title & Type */}
            <div className="mt-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedAchievement.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Loại: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedAchievement.achievementType?.name || selectedAchievement.achievementTypeName || 'Chưa phân loại'}</span>
              </p>
            </div>

            {/* Status Banners (W2-Q3) */}
            <div className="mt-3 space-y-2">
              {selectedAchievement.status === 'VERIFIED' && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Hồ sơ đã được thẩm định & xác nhận (VERIFIED). Nội dung và tệp minh chứng đã khóa bảo vệ toàn vẹn (Immutability).</span>
                </div>
              )}

              {selectedAchievement.status === 'NEED_CORRECTION' && selectedAchievement.latestCorrectionReason && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Yêu cầu sửa đổi bổ sung từ cấp thẩm định:</strong>
                    <p className="mt-0.5">{selectedAchievement.latestCorrectionReason}</p>
                  </div>
                </div>
              )}

              {selectedAchievement.status === 'SUBMITTED' && isSelf(selectedAchievement) && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span><strong>Quy chế Liêm chính:</strong> Bạn là người kê khai/chủ hồ sơ này, bạn không được tự thẩm định (Anti-self-approval).</span>
                  </div>
                  <button
                    onClick={() => openActionModal(selectedAchievement, 'CANCEL')}
                    className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1 flex-shrink-0 shadow-soft-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Hủy nộp
                  </button>
                </div>
              )}

              {selectedAchievement.status === 'SUBMITTED' && canReview && !isSelf(selectedAchievement) && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Thao tác thẩm định:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openActionModal(selectedAchievement, 'VERIFY')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-soft-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Xác nhận (VERIFY)
                    </button>
                    <button
                      onClick={() => openActionModal(selectedAchievement, 'REQUEST_CORRECTION')}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-soft-sm"
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> Yêu cầu bổ sung
                    </button>
                    <button
                      onClick={() => openActionModal(selectedAchievement, 'REJECT')}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-soft-sm"
                    >
                      <X className="w-3.5 h-3.5" /> Từ chối
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Detail Tabs */}
            <div className="mt-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <button
                type="button"
                onClick={() => setDetailTab('INFO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  detailTab === 'INFO'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Thông tin & Minh chứng</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('HISTORIES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  detailTab === 'HISTORIES'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử thẩm định ({histories.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('SUBMISSIONS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  detailTab === 'SUBMISSIONS'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lần nộp & Snapshot ({submissions.length})</span>
              </button>
            </div>

            {/* TAB CONTENT: 1. INFO & EVIDENCES */}
            {detailTab === 'INFO' && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Chủ thể</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAchievement.subjectType === 'LECTURER' ? 'Cá nhân Giảng viên' : 'Tập thể Đơn vị'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Đơn vị quản lý (ContextUnit)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAchievement.contextUnit?.name || selectedAchievement.contextUnitName || `Unit #${selectedAchievement.contextUnitId}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Năm ghi nhận</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAchievement.recognitionYear}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Vai trò</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAchievement.contributionRole || 'Chưa ghi rõ'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Thời gian thực hiện</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAchievement.startDate || '—'} đến {selectedAchievement.endDate || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Phiên bản (Concurrency)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      v{selectedAchievement.version}
                    </span>
                  </div>
                </div>

                {selectedAchievement.description && (
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Tóm tắt & Kết quả
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                      {selectedAchievement.description}
                    </p>
                  </div>
                )}

                {/* PHÂN HỆ MINH CHỨNG SỐ & PHIÊN BẢN TỆP (W2-Q2) */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Minh chứng số & Phiên bản tệp ({evidences.length})
                      </h4>
                    </div>
                    {['DRAFT', 'NEED_CORRECTION'].includes(selectedAchievement.status) && (
                      <button
                        type="button"
                        onClick={() => setEvidenceFormOpen(!evidenceFormOpen)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 dark:text-teal-300 text-xs font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{evidenceFormOpen ? 'Hủy' : 'Thêm minh chứng'}</span>
                      </button>
                    )}
                  </div>

                  {evidenceError && (
                    <div className="mb-3 p-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{evidenceError}</span>
                    </div>
                  )}

                  {/* Form thêm minh chứng mới */}
                  {evidenceFormOpen && (
                    <form onSubmit={handleCreateEvidence} className="mb-4 p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/50 space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Tên minh chứng / Quyết định <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="VD: Hợp đồng NCKH số 45/HĐ-KHCN"
                          value={evidenceFormData.title}
                          onChange={(e) => setEvidenceFormData({ ...evidenceFormData, title: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Diễn giải chi tiết
                        </label>
                        <input
                          type="text"
                          placeholder="Ghi chú thêm về văn bản đính kèm..."
                          value={evidenceFormData.description}
                          onChange={(e) => setEvidenceFormData({ ...evidenceFormData, description: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Chọn tệp đính kèm (PDF, JPG, PNG, DOCX tối đa 10 MB) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="file"
                          required
                          accept=".pdf,.jpg,.jpeg,.png,.docx"
                          onChange={(e) => setEvidenceFormData({ ...evidenceFormData, file: e.target.files?.[0] || null })}
                          className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-600 file:text-white hover:file:bg-teal-700"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={evidenceSubmitting}
                          className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition disabled:opacity-50"
                        >
                          {evidenceSubmitting ? 'Đang tải lên...' : 'Tải lên minh chứng'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Danh sách các minh chứng */}
                  {evidencesLoading ? (
                    <div className="py-4 text-center text-xs text-slate-400">Đang tải danh sách minh chứng...</div>
                  ) : evidences.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      Chưa có tệp minh chứng nào được đính kèm.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {evidences.map((ev) => (
                        <div
                          key={ev.evidenceId}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {ev.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                v{ev.latestVersionNo || 1}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{ev.description}</p>
                            )}
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                              <span>Tệp: {ev.latestFileName || 'Chưa có tệp'}</span>
                              {ev.latestFileSize && (
                                <span>{(ev.latestFileSize / 1024).toFixed(1)} KB</span>
                              )}
                              {ev.totalVersions > 1 && (
                                <span>Tổng {ev.totalVersions} phiên bản</span>
                              )}
                            </div>
                          </div>

                          {/* Nút thao tác tệp */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ev.latestFileId && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(ev.latestFileId, ev.latestFileName)}
                                title="Tải về tệp minh chứng"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              >
                                <Download className="w-3.5 h-3.5 text-teal-600" />
                                <span>Tải về</span>
                              </button>
                            )}

                            {['DRAFT', 'NEED_CORRECTION'].includes(selectedAchievement.status) && (
                              <>
                                <label
                                  title="Thay tệp mới (tăng phiên bản)"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                                >
                                  <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Thay file</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadFileVersion(ev.evidenceId, file);
                                    }}
                                  />
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteEvidence(ev.evidenceId)}
                                  title="Xóa minh chứng"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. STATUS HISTORIES (W2-Q3) */}
            {detailTab === 'HISTORIES' && (
              <div className="mt-4 space-y-3">
                {historyLoading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Đang tải lịch sử thẩm định...</div>
                ) : histories.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    Chưa có bản ghi lịch sử trạng thái nào.
                  </div>
                ) : (
                  histories.map((h) => {
                    const fromBadge = STATUS_BADGES[h.fromStatus] || { label: h.fromStatus, color: 'bg-slate-100 text-slate-700' };
                    const toBadge = STATUS_BADGES[h.toStatus] || { label: h.toStatus, color: 'bg-slate-100 text-slate-700' };
                    return (
                      <div
                        key={h.historyId}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${fromBadge.color}`}>
                              {fromBadge.label}
                            </span>
                            <span className="text-slate-400 font-bold">→</span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${toBadge.color}`}>
                              {toBadge.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {h.createdAt ? new Date(h.createdAt).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          Người thực hiện: <strong className="text-slate-900 dark:text-white">{h.actorName || `User #${h.actorId}`}</strong>
                        </div>
                        {h.reason && (
                          <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Ghi chú / Căn cứ: </span>
                            {h.reason}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB CONTENT: 3. SUBMISSIONS & SNAPSHOT (W2-Q3) */}
            {detailTab === 'SUBMISSIONS' && (
              <div className="mt-4 space-y-4">
                {historyLoading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Đang tải danh sách lần nộp & snapshot...</div>
                ) : submissions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    Chưa có lần nộp thẩm định nào được ghi nhận.
                  </div>
                ) : (
                  submissions.map((sub) => {
                    const snap = sub.snapshotData || {};
                    const snapEvidences = snap.evidences || [];
                    return (
                      <div
                        key={sub.submissionId}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-xs">
                              Lần nộp #{sub.revisionNo}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              Người nộp: <strong className="text-slate-800 dark:text-white">{sub.submitterName || `User #${sub.submittedBy}`}</strong>
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>

                        {snap.submitNote && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Ghi chú nộp: </span>
                            {snap.submitNote}
                          </div>
                        )}

                        {/* Snapshot metadata */}
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-slate-400">Tiêu đề:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.title}</strong></div>
                          <div><span className="text-slate-400">Chủ thể:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.subjectType}</strong></div>
                          <div><span className="text-slate-400">Năm ghi nhận:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.recognitionYear}</strong></div>
                          <div><span className="text-slate-400">Phiên bản lúc nộp:</span> <strong className="text-slate-800 dark:text-slate-200">v{snap.version}</strong></div>
                        </div>

                        {/* Frozen Evidence Files */}
                        <div>
                          <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600" />
                            <span>Tệp minh chứng đã đóng băng trong snapshot ({snapEvidences.length})</span>
                          </div>
                          {snapEvidences.length === 0 ? (
                            <div className="text-slate-400 italic">Không có tệp minh chứng nào tại thời điểm nộp.</div>
                          ) : (
                            <div className="space-y-1.5">
                              {snapEvidences.map((evItem) => {
                                const file = evItem.files?.[0] || {};
                                return (
                                  <div
                                    key={evItem.evidenceId}
                                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                                  >
                                    <div className="truncate">
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{evItem.title}</span>
                                      <span className="text-slate-400 ml-2">({file.fileName || 'Tệp'} - v{file.versionNo || 1})</span>
                                    </div>
                                    {file.fileId && (
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadFile(file.fileId, file.fileName)}
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1 text-[11px] transition"
                                      >
                                        <Download className="w-3 h-3 text-teal-600" />
                                        Tải về
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Thao tác luồng thẩm định (W2-Q3) */}
      {actionModalOpen && targetAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-soft-2xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {actionType === 'SUBMIT' && <Send className="w-5 h-5 text-teal-600" />}
                {actionType === 'VERIFY' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {actionType === 'REQUEST_CORRECTION' && <AlertCircle className="w-5 h-5 text-amber-600" />}
                {actionType === 'REJECT' && <X className="w-5 h-5 text-rose-600" />}
                {actionType === 'CANCEL' && <RotateCcw className="w-5 h-5 text-amber-600" />}
                {actionType === 'REVOKE' && <ShieldAlert className="w-5 h-5 text-purple-600" />}
                <span>
                  {actionType === 'SUBMIT' && 'Nộp hồ sơ thành tích thẩm định'}
                  {actionType === 'VERIFY' && 'Xác nhận & Phê duyệt thành tích'}
                  {actionType === 'REQUEST_CORRECTION' && 'Yêu cầu sửa đổi bổ sung'}
                  {actionType === 'REJECT' && 'Từ chối thành tích'}
                  {actionType === 'CANCEL' && 'Hủy yêu cầu nộp hồ sơ'}
                  {actionType === 'REVOKE' && 'Thu hồi quyết định xác nhận (Admin)'}
                </span>
              </h2>
              <button
                onClick={() => setActionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">
                  {targetAchievement.title}
                </div>
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-3">
                  <span>Mã: #{targetAchievement.achievementId}</span>
                  <span>Phiên bản: <strong>v{targetAchievement.version}</strong></span>
                  <span>Trạng thái: <strong>{targetAchievement.status}</strong></span>
                </div>
              </div>

              {actionType === 'SUBMIT' && (
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-900/40">
                  <p>Hồ sơ sẽ được tạo một snapshot bất biến đóng băng phiên bản tệp minh chứng và chuyển sang trạng thái <strong>SUBMITTED</strong> chờ cấp quản lý thẩm định.</p>
                </div>
              )}

              {actionType === 'VERIFY' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/40">
                  <p>Hồ sơ sẽ chuyển sang trạng thái <strong>VERIFIED</strong>. Mọi chỉnh sửa nội dung và thay thế tệp minh chứng sẽ được khóa vĩnh viễn (Immutability).</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {['REQUEST_CORRECTION', 'REJECT', 'CANCEL', 'REVOKE'].includes(actionType) ? (
                    <>Lý do thực hiện <span className="text-rose-500">*</span></>
                  ) : (
                    <>Ghi chú đính kèm (tùy chọn)</>
                  )}
                </label>
                <textarea
                  rows={3}
                  required={['REQUEST_CORRECTION', 'REJECT', 'CANCEL', 'REVOKE'].includes(actionType)}
                  placeholder={
                    actionType === 'REQUEST_CORRECTION'
                      ? 'Nêu rõ tài liệu, thông tin cần bổ sung hoặc sửa chữa...'
                      : actionType === 'REJECT'
                      ? 'Nêu rõ căn cứ từ chối hồ sơ...'
                      : actionType === 'CANCEL'
                      ? 'Lý do rút lại hồ sơ...'
                      : actionType === 'REVOKE'
                      ? 'Căn cứ quyết định thu hồi...'
                      : 'Nhập ghi chú (nếu có)...'
                  }
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white resize-none text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className={`px-4 py-2 rounded-xl font-medium text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-soft-sm ${
                    actionType === 'VERIFY'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : actionType === 'REJECT' || actionType === 'REVOKE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : actionType === 'REQUEST_CORRECTION' || actionType === 'CANCEL'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#008080] hover:bg-[#006666]'
                  }`}
                >
                  {actionSubmitting ? 'Đang xử lý...' : 'Xác nhận thực hiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
