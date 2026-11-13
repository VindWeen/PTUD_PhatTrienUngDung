import Select from '../components/common/Select';
import UnderlineTabs from '../components/common/UnderlineTabs';
import PageHeader from '../components/common/PageHeader';
import { useSearchParams } from 'react-router-dom';
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
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { achievementsApi } from '../services/achievementsApi';
import { organizationsApi } from '../services/organizationsApi';
import { evidencesApi, validateEvidenceFile } from '../services/evidencesApi';
import { LoadingState, ErrorState, EmptyState } from '../components/common/AsyncState';

const STATUS_BADGES = {
  ACTIVE: {
    label: 'Sẵn sàng sử dụng',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800',
  },
  DRAFT: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  SUBMITTED: { label: 'Chờ duyệt', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  NEED_CORRECTION: { label: 'Cần bổ sung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  VERIFIED: { label: 'Đã xác nhận', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  REJECTED: { label: 'Từ chối', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  REVOKED: { label: 'Đã thu hồi', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

export default function Achievements() {
  const [routeParams] = useSearchParams();
  const { user } = useAuth();
  const userRoles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.code));
  const isManager = userRoles.includes('MANAGER');
  const canReview = isManager;
  const canCreate = Boolean(user);

  const [items, setItems] = useState([]);
  const [trashActionId, setTrashActionId] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workflow tabs keep drafts and corrections ahead of completed records.
  const [activeTab, setActiveTab] = useState(canReview ? 'PENDING' : 'ACTIONABLE');

  // Filters
  const [subjectFilter, setSubjectFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState(() => (routeParams.get('search') || '').slice(0, 100));
  const [yearFilter, setYearFilter] = useState('');

  // Danh mục loại thành tích & đơn vị
  const [types, setTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogRetry, setCatalogRetry] = useState(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(routeParams.get('create') === '1');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [detailTab, setDetailTab] = useState('INFO'); // 'INFO' | 'HISTORIES' | 'SUBMISSIONS'
  const [isEditing, setIsEditing] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [pendingEvidences, setPendingEvidences] = useState([]);

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
  const [historyError, setHistoryError] = useState(null);

  // AI Vision Certificate OCR Modal States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiFile, setAiFile] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiNotice, setAiNotice] = useState(null);

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

  const loadData = useCallback(async (fresh = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await achievementsApi.list({
        page: pagination.page,
        pageSize: pagination.pageSize,
        subjectType: subjectFilter || undefined,
        workflow: ['ALL', 'TRASH'].includes(activeTab) ? undefined : activeTab,
        trash: activeTab === 'TRASH' ? 'true' : undefined,
        search: searchQuery || undefined,
        recognitionYear: yearFilter || undefined,
      }, fresh);
      setItems(res.items || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, subjectFilter, searchQuery, yearFilter, activeTab]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    let active = true;
    const refresh = async (event) => {
      if (!event.detail.some(n => n.entityType === 'ACHIEVEMENT')) return;
      loadData(true);
      const selectedId = selectedAchievement?.achievementId;
      if (detailModalOpen && selectedId) {
        try {
          const detail = await achievementsApi.getById(selectedId, true);
          if (active) {
            setSelectedAchievement(detail);
            loadHistoryAndSubmissions(selectedId);
          }
        } catch (err) { if (active) setError(err); }
      }
    };
    window.addEventListener('workflow-updated', refresh);
    return () => { active = false; window.removeEventListener('workflow-updated', refresh); };
  }, [loadData, detailModalOpen, selectedAchievement?.achievementId]);

  // Load danh mục loại thành tích và tổ chức
  useEffect(() => {
    async function fetchCatalogs() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [typesData, unitsData] = await Promise.all([
          achievementsApi.listAchievementTypes(),
          organizationsApi.list(),
        ]);
        setTypes(Array.isArray(typesData) ? typesData : []);
        setUnits(Array.isArray(unitsData) ? unitsData : []);
      } catch (err) {
        setCatalogError(err);
      } finally {
        setCatalogLoading(false);
      }
    }
    fetchCatalogs();
  }, [catalogRetry]);

  const openCreateModal = () => {
    setIsEditing(false);
    setPendingEvidences([]);
    setEvidences([]);
    setEvidenceError(null);
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
    setDetailModalOpen(false);
    setIsEditing(true);
    setSelectedAchievement(ach);
    setPendingEvidences([]);
    setEvidences([]);
    loadEvidences(ach.achievementId);
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
    if (ach.actions) return ach.actions.isSelf;
    const uid = user.userId || user.id;
    return [ach.createdBy, ach.submittedBy, ach.lecturer?.userId, ach.lecturerUserId]
      .some(id => id != null && String(id) === String(uid));
  };
  const canAct = (ach, action) => Boolean(ach?.actions?.[action]);

  const loadHistoryAndSubmissions = async (achievementId) => {
    if (!achievementId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    setHistories([]);
    setSubmissions([]);
    try {
      const [histData, subData] = await Promise.all([
        achievementsApi.getHistory(achievementId),
        achievementsApi.getSubmissions(achievementId),
      ]);
      setHistories(Array.isArray(histData) ? histData : histData?.histories || []);
      setSubmissions(Array.isArray(subData) ? subData : subData?.submissions || []);
    } catch (err) {
      setHistoryError(err.message || 'Không thể tải lịch sử hồ sơ. Vui lòng thử lại.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openDetailModal = async (ach) => {
    try {
      setDetailTab('INFO');
      setEvidences([]);
      const detail = await achievementsApi.getById(ach.achievementId);
      setSelectedAchievement(detail);
      setDetailModalOpen(true);
      setEvidenceFormOpen(false);
      setEvidenceFormData({ title: '', description: '', file: null });
      loadEvidences(detail.achievementId);
      loadHistoryAndSubmissions(detail.achievementId);
    } catch (err) {
      alert(`Không thể xem chi tiết: ${err.message}`);
    }
  };

  useEffect(() => {
    const requestedId = routeParams.get('id');
    if (requestedId && /^\d+$/.test(requestedId)) openDetailModal({ achievementId: Number(requestedId) });
    // Route selection opens once; later edits use the existing detail workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams]);

  const handleAiFileSelect = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Tệp vượt quá dung lượng 10MB cho phép.');
      return;
    }
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
      alert('Chỉ hỗ trợ tệp định dạng JPG, PNG hoặc PDF.');
      return;
    }
    setAiFile(file);
    if (file.type.startsWith('image/')) {
      setAiPreview(URL.createObjectURL(file));
    } else {
      setAiPreview(null);
    }
  };

  const handleAiExtract = async () => {
    if (!aiFile) return;
    setAiScanning(true);
    const fileToKeep = aiFile;
    try {
      const res = await achievementsApi.aiExtract(aiFile);
      if (res?.fallback || !res?.data) {
        setAiModalOpen(false);
        openCreateModal();
        setPendingEvidences([
          {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
            file: fileToKeep,
            title: fileToKeep.name.replace(/\.[^/.]+$/, '').slice(0, 255),
            description: 'Minh chứng tệp đính kèm (AI Fallback)',
          },
        ]);
        setAiNotice({
          type: 'info',
          message: res?.message || 'Trợ lý AI chưa trích xuất được đủ thông tin từ tài liệu. Tệp đã được đính kèm vào minh chứng, vui lòng tự điền thông tin vào biểu mẫu.',
        });
      } else {
        const extracted = res.data;
        setAiModalOpen(false);
        openCreateModal();

        let matchedTypeId = types[0]?.achievement_type_id || '';
        if (extracted.category === 'SCIENTIFIC_RESEARCH' || extracted.category === 'RESEARCH') {
          const found = types.find(t => /RESEARCH|NCKH|JOURNAL|PATENT/i.test(t.code || t.name));
          if (found) matchedTypeId = found.achievement_type_id;
        } else if (extracted.category === 'TEACHING') {
          const found = types.find(t => /TEACH|CURRICULUM|GIANG_DAY/i.test(t.code || t.name));
          if (found) matchedTypeId = found.achievement_type_id;
        }

        setFormData(prev => ({
          ...prev,
          title: extracted.title || prev.title,
          recognitionYear: extracted.recognitionYear || prev.recognitionYear,
          startDate: extracted.issueDate || prev.startDate,
          endDate: extracted.issueDate || prev.endDate,
          contributionRole: (extracted.category === 'SCIENTIFIC_RESEARCH' || extracted.category === 'RESEARCH') ? 'Tác giả' : prev.contributionRole,
          description: [
            extracted.issuer ? `Đơn vị cấp: ${extracted.issuer}` : null,
            extracted.decisionNumber ? `Số quyết định: ${extracted.decisionNumber}` : null,
          ].filter(Boolean).join('\n') || prev.description,
          achievementTypeId: matchedTypeId,
        }));

        setPendingEvidences([
          {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
            file: fileToKeep,
            title: extracted.title || fileToKeep.name.slice(0, 255),
            description: `Minh chứng trích xuất từ AI Vision (Số QĐ: ${extracted.decisionNumber || '—'})`,
          },
        ]);

        setAiNotice({
          type: 'success',
          message: '✨ AI Vision đã trích xuất thành công thông tin bằng khen! Tệp chứng nhận đã được tự động thêm vào danh sách minh chứng.',
        });
      }
    } catch (err) {
      setAiModalOpen(false);
      openCreateModal();
      if (fileToKeep) {
        setPendingEvidences([
          {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
            file: fileToKeep,
            title: fileToKeep.name.replace(/\.[^/.]+$/, '').slice(0, 255),
            description: 'Minh chứng tệp đính kèm (AI Fallback)',
          },
        ]);
      }
      setAiNotice({
        type: 'info',
        message: 'Dịch vụ AI Vision tạm thời gián đoạn. Tệp đã được lưu vào minh chứng, vui lòng tự nhập các thông tin để tiếp tục.',
      });
    } finally {
      setAiScanning(false);
      setAiFile(null);
      setAiPreview(null);
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
    if (!file || evidenceSubmitting) return;
    setEvidenceSubmitting(true);
    setEvidenceError(null);
    try {
      await evidencesApi.uploadFileVersion(evidenceId, file);
      if (selectedAchievement) {
        await loadEvidences(selectedAchievement.achievementId);
      }
    } catch (err) {
      setEvidenceError(err.message || 'Không thể tải lên phiên bản mới');
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    if (evidenceSubmitting) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa minh chứng này khỏi hồ sơ?')) return;
    setEvidenceSubmitting(true);
    setEvidenceError(null);
    try {
      await evidencesApi.deleteEvidence(evidenceId);
      if (selectedAchievement) {
        await loadEvidences(selectedAchievement.achievementId);
      }
    } catch (err) {
      setEvidenceError(err.message || 'Không thể xóa minh chứng');
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const handleDownloadFile = async (fileId, fileName) => {
    try {
      await evidencesApi.downloadEvidenceFile(fileId, fileName);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Không thể tải về tệp tin này');
    }
  };

  const addEvidenceFiles = (files) => {
    try {
      const selected = Array.from(files || []);
      selected.forEach(validateEvidenceFile);
      setPendingEvidences(current => [...current, ...selected.map(file => ({id:crypto.randomUUID(),file,title:file.name.slice(0,255),description:''}))]);
      setFormError(null);
    } catch (err) { setFormError(err.message); }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    let saved;
    try {
      for (const evidence of pendingEvidences) {
        validateEvidenceFile(evidence.file);
        if (evidence.title.trim().length < 3 || evidence.title.trim().length > 255) throw new Error('Tên minh chứng phải có từ 3 đến 255 ký tự.');
      }
      if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
        throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
      }

      if (isEditing && selectedAchievement) {
        saved = await achievementsApi.update(selectedAchievement.achievementId, {
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
        saved = await achievementsApi.create({
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

      // Keep the persisted ID/version if an upload fails so retrying cannot create another draft.
      setIsEditing(true);
      setSelectedAchievement({...saved,actions:saved.actions || (isEditing ? selectedAchievement?.actions : {manageEvidence:true})});
      setFormData(current => ({...current,version:saved.version}));
      for (const evidence of pendingEvidences) {
        try { await evidencesApi.createEvidence(saved.achievementId, evidence); }
        catch (err) { throw new Error(`${evidence.file.name}: ${err.message || 'Tải tệp thất bại'}`); }
        setPendingEvidences(current => current.filter(item => item.id !== evidence.id));
      }
      setModalOpen(false);
      await loadData();
      await openDetailModal(saved);
    } catch (err) {
      setFormError(saved ? `Hồ sơ đã được lưu. Chưa tải được hết minh chứng: ${err.message || 'Vui lòng thử lại.'} Các tệp còn lại được giữ để bạn lưu lại.` : (err.message || 'Thao tác không thành công.'));
      if (saved) { loadEvidences(saved.achievementId); loadData(); }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (ach) => {
    if (!window.confirm(`Chuyển bản nháp "${ach.title}" vào thùng rác? Bạn có thể khôi phục trong 30 ngày.`)) {
      return;
    }
    try {
      setTrashActionId(ach.achievementId);
      await achievementsApi.remove(ach.achievementId);
      if (items.length === 1 && pagination.page > 1) setPagination(prev => ({ ...prev, page: prev.page - 1 }));
      else await loadData();
    } catch (err) {
      setError(err);
    } finally { setTrashActionId(null); }
  };

  const handleRestore = async (ach) => {
    try {
      setTrashActionId(ach.achievementId);
      await achievementsApi.restore(ach.achievementId);
      if (items.length === 1 && pagination.page > 1) setPagination(prev => ({ ...prev, page: prev.page - 1 }));
      else await loadData();
    } catch (err) { setError(err); }
    finally { setTrashActionId(null); }
  };

  const handleCreateReplacement = async (ach) => {
    if (!window.confirm(`Bạn có chắc chắn muốn tạo bản kê khai mới thay thế cho hồ sơ #${ach.achievementId} (${ach.title})?`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await achievementsApi.replace(ach.achievementId);
      await loadData();
      await openDetailModal(res);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Lỗi khi tạo bản thay thế');
    } finally {
      setLoading(false);
    }
  };

  const renderActions = ach => {
    if (ach.deletedAt) return canAct(ach, 'restore') ? <button type="button" className="soft-btn-secondary text-sm disabled:opacity-50" disabled={trashActionId === ach.achievementId} aria-busy={trashActionId === ach.achievementId} onClick={() => handleRestore(ach)}><RotateCcw className="h-4 w-4" />Khôi phục</button> : <span className="text-xs text-slate-500">Chỉ chủ sở hữu được khôi phục</span>;

    const actions = [
      { key: 'edit', label: 'Chỉnh sửa', icon: Edit2, run: () => openEditModal(ach) },
      { key: 'remove', label: 'Xóa', icon: Trash2, run: () => handleDelete(ach) },
    ].filter(action => canAct(ach, action.key) || isSelf(ach));
    const tones = {
      'Xem chi tiết': 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300',
      'Chỉnh sửa': 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    };
    const dangerTone = 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300';
    return <div className="flex flex-wrap items-center gap-1.5">
      {[{label: 'Xem chi tiết', icon: Eye, run: () => openDetailModal(ach)}, ...actions].map(({label, icon: Icon, run}) => <button type="button" key={label} onClick={run} disabled={trashActionId === ach.achievementId} aria-label={label} title={label} className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${tones[label] || dangerTone}`}><Icon aria-hidden="true" className="h-4 w-4" /></button>)}
    </div>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kho Thành tích Cá nhân"
        description="Kê khai, theo dõi và quản lý thành tích trong Kho số cá nhân (ACTIVE) sẵn sàng tham gia thẩm định và xuất CV."
        icon={Award}
        onRefresh={loadData}
        refreshing={loading}
        secondaryActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              disabled={catalogLoading || !types.length}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 transition shadow-soft-sm"
            >
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>✨ Quét AI Bằng khen</span>
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'TRASH'}
              onClick={() => { setActiveTab(activeTab === 'TRASH' ? 'ALL' : 'TRASH'); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="soft-btn-secondary h-11 text-sm"
            >
              <Trash2 className="h-4 w-4" />Thùng rác
            </button>
          </div>
        }
        primaryAction={canCreate ? {label: 'Kê khai Thành tích', onClick: openCreateModal, disabled: catalogLoading || !types.length} : null}
        tabs={<UnderlineTabs label="Danh sách thành tích" value={activeTab} onChange={tab => { setActiveTab(tab); setPagination(prev => ({ ...prev, page: 1 })); }} items={[
          {id: 'ALL', label: 'Kho thành tích (Tất cả)', icon: Award},
          {id: 'ACTIONABLE', label: 'Cần hoàn thiện', icon: Edit2},
          {id: 'VERIFIED', label: 'Đã xác nhận', icon: CheckCircle2},
          {id: 'ENDED', label: 'Từ chối / Thu hồi / Hủy', icon: ShieldAlert},
          ...(activeTab === 'TRASH' ? [{id: 'TRASH', label: 'Thùng rác', icon: Trash2}] : []),
        ]} />}
      />

      {activeTab === 'TRASH' && <p className="text-sm text-slate-600 dark:text-slate-300">Bản nháp được giữ trong 30 ngày kể từ lúc xóa. Khôi phục trước hạn để tiếp tục chỉnh sửa; sau hạn, hệ thống tự động xóa vĩnh viễn.</p>}
      {catalogError && <ErrorState error={catalogError} onRetry={() => setCatalogRetry(value => value + 1)} />}
      {!catalogLoading && !catalogError && !types.length && <p className="text-sm text-amber-700">Chưa có loại thành tích đang hoạt động. Liên hệ quản trị viên bổ sung danh mục trước khi kê khai.</p>}

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-soft-sm flex flex-col xl:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            aria-label="Tìm thành tích" placeholder="Tìm theo tiêu đề hoặc nội dung thành tích..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 dark:text-white"
          />
        </div>

        {/* Filter: Subject Type */}
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem] xl:w-[360px]">
          <Select aria-label="Lọc theo chủ thể" value={subjectFilter}
            onChange={(e) => { setSubjectFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">Tất cả chủ thể</option>
            <option value="LECTURER">Cá nhân (Giảng viên)</option>
            <option value="UNIT">Tập thể (Đơn vị)</option>
          </Select>

          {/* Filter: Year */}
          <input
            type="number"
            aria-label="Lọc theo năm" placeholder="Năm"
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="w-full min-w-0 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          />


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
          <div className="divide-y divide-slate-200 dark:divide-slate-700 lg:hidden">
            {items.map(ach => {
              const badge = STATUS_BADGES[ach.status] || { label: ach.status, color: 'bg-slate-100 text-slate-700' };
              return <article key={ach.achievementId} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{ach.subjectType === 'LECTURER' ? 'Cá nhân' : 'Tập thể'} · {ach.recognitionYear}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>{ach.deletedAt ? 'Trong thùng rác' : badge.label}</span></div>
                <h2 className="break-words text-sm font-semibold text-slate-900 dark:text-white">{ach.title}</h2>
                <dl className="space-y-1 text-sm text-slate-600 dark:text-slate-300"><div><dt className="inline font-medium">Chủ thể: </dt><dd className="inline">{ach.subjectName || (ach.subjectType === 'LECTURER' ? 'Giảng viên' : 'Đơn vị')}</dd></div><div><dt className="inline font-medium">Loại: </dt><dd className="inline">{ach.achievementTypeName || ach.achievementTypeCode || '—'}</dd></div><div><dt className="inline font-medium">Đơn vị: </dt><dd className="inline">{ach.contextUnitName || 'Chưa có thông tin'}</dd></div></dl>
                {ach.deletedAt && <p className="text-xs text-slate-600 dark:text-slate-300">Hạn khôi phục: {new Date(ach.expiresAt).toLocaleDateString('vi-VN')}</p>}
                {renderActions(ach)}
              </article>;
            })}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-700/80">
                <tr>
                  <th className="min-w-[260px] px-4 py-4">Chủ thể & Tiêu đề</th>
                  <th className="min-w-[180px] px-4 py-4">Loại thành tích</th>
                  <th className="min-w-[160px] px-4 py-4">Đơn vị quản lý</th>
                  <th className="px-4 py-4">{activeTab === 'TRASH' ? 'Hạn khôi phục' : 'Năm'}</th>
                  <th className="min-w-[110px] px-4 py-4">Trạng thái</th>
                  <th className="min-w-[240px] px-4 py-4">Thao tác</th>
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
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              isPersonal
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            {isPersonal ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                            {isPersonal ? 'Cá nhân' : 'Tập thể'}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                              {ach.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {ach.subjectName || (isPersonal ? 'Giảng viên' : 'Đơn vị')}
                              {ach.contributionRole ? ` • ${ach.contributionRole}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {ach.achievementTypeName || ach.achievementTypeCode || '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        {ach.contextUnitName || `Unit #${ach.contextUnitId}`}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-200">
                        {ach.recognitionYear}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                          {ach.deletedAt ? 'Trong thùng rác' : statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">{renderActions(ach)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
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
                <span>{isEditing ? 'Chỉnh sửa Thành tích' : 'Kê khai Thành tích vào Kho'}</span>
              </h2>
              <button
                disabled={formSubmitting || evidenceSubmitting}
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiNotice && (
              <div className={`mt-4 p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                aiNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
                  <span>{aiNotice.message}</span>
                </div>
                <button type="button" onClick={() => setAiNotice(null)} className="p-1 hover:opacity-75">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4 text-sm">
              <fieldset disabled={formSubmitting || evidenceSubmitting} className="space-y-4">
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
                  <Select
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
                  </Select>
                </div>
              )}

              {/* Loại thành tích */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Loại Thành tích <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={formData.achievementTypeId}
                  onChange={(e) => setFormData({ ...formData, achievementTypeId: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                >
                  <option value="">-- Chọn loại thành tích --</option>
                  {types.map((t) => (
                    <option key={t.achievement_type_id} value={t.achievement_type_id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
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

              <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <h3 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-teal-600"/>Minh chứng đính kèm</h3>
                {isEditing && <>
                  {canAct(selectedAchievement,'manageEvidence') && !!evidences.length && <p className="text-xs text-slate-500">Thay tệp hoặc xóa minh chứng đã lưu sẽ áp dụng ngay. Thay tệp giữ lại các phiên bản cũ.</p>}
                  {evidencesLoading && <p role="status" className="text-xs text-slate-500">Đang tải minh chứng đã lưu…</p>}
                  {evidenceError && <p role="alert" className="text-xs text-rose-600">{evidenceError}</p>}
                  <ul className="space-y-2">{evidences.map(ev => <li key={ev.evidenceId} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                    <p className="break-words font-medium">{ev.title}</p><p className="mt-1 break-all text-xs text-slate-500">{ev.latestFileName || 'Chưa có tệp'} · Phiên bản {ev.latestVersionNo || 1}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ev.latestFileId && <button type="button" className="soft-btn-secondary text-xs" onClick={() => handleDownloadFile(ev.latestFileId,ev.latestFileName)}><Download className="h-3.5 w-3.5"/>Tải xuống</button>}
                      {canAct(selectedAchievement,'manageEvidence') && <>
                        <label className="soft-btn-secondary cursor-pointer text-xs focus-within:ring-2 focus-within:ring-teal-500"><UploadCloud className="h-3.5 w-3.5"/>Thay tệp<input type="file" className="sr-only" aria-label={`Thay tệp ${ev.title}`} accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e => {handleUploadFileVersion(ev.evidenceId,e.target.files?.[0]);e.target.value='';}}/></label>
                        <button type="button" className="soft-btn-secondary text-xs text-rose-600" onClick={() => handleDeleteEvidence(ev.evidenceId)}><Trash2 className="h-3.5 w-3.5"/>Xóa minh chứng</button>
                      </>}
                    </div>
                  </li>)}</ul>
                </>}
                {(!isEditing || canAct(selectedAchievement,'manageEvidence')) && <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50 p-3 text-teal-700 focus-within:ring-2 focus-within:ring-teal-500 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"><UploadCloud className="h-5 w-5"/><span className="font-semibold">Chọn tệp minh chứng</span><input type="file" multiple className="sr-only" aria-label="Chọn tệp minh chứng cho thành tích" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e => {addEvidenceFiles(e.target.files);e.target.value='';}}/></label>
                  <p className="text-xs text-slate-500">Có thể chọn nhiều tệp PDF, JPG, PNG, DOCX, tối đa 10 MB/tệp. Tệp mới được tải lên khi lưu hồ sơ.</p>
                  <ul className="space-y-3">{pendingEvidences.map(ev => <li key={ev.id} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-all text-xs text-slate-500">{ev.file.name} · {(ev.file.size/1024).toFixed(1)} KB · Chưa tải lên</p><button type="button" aria-label={`Bỏ tệp ${ev.file.name}`} className="shrink-0 text-rose-500" onClick={() => setPendingEvidences(current => current.filter(item => item.id !== ev.id))}><X className="h-4 w-4"/></button></div>
                    <label className="block space-y-1 text-xs font-semibold">Tên minh chứng<input required minLength={3} maxLength={255} className="soft-input w-full" value={ev.title} onChange={e => setPendingEvidences(current => current.map(item => item.id === ev.id ? {...item,title:e.target.value} : item))}/></label>
                    <label className="block space-y-1 text-xs font-semibold">Ghi chú minh chứng<input maxLength={500} className="soft-input w-full" value={ev.description} onChange={e => setPendingEvidences(current => current.map(item => item.id === ev.id ? {...item,description:e.target.value} : item))}/></label>
                  </li>)}</ul>
                </>}
              </section>

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
                  {formSubmitting ? 'Đang lưu...' : isEditing ? 'Cập nhật thành tích' : 'Lưu vào Kho Thành tích'}
                </button>
              </div>
              </fieldset>
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

              {selectedAchievement.status === 'ACTIVE' && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Thành tích trong Kho cá nhân đã có hiệu lực (ACTIVE), sẵn sàng để đối soát quy chế và hiển thị trên CV.</span>
                </div>
              )}

              {selectedAchievement.replacesAchievementId && (
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                  <span>Bản kê khai này thay thế cho hồ sơ kết thúc: <strong>#{selectedAchievement.replacesAchievementId}</strong></span>
                </div>
              )}
            </div>

            {/* Modal Detail Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canAct(selectedAchievement, 'edit') && <button type="button" onClick={() => openEditModal(selectedAchievement)} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-medium">Sửa hồ sơ</button>}
            </div>
            {historyError && <div role="alert" className="mt-3 text-sm text-rose-700">{historyError} <button type="button" onClick={() => loadHistoryAndSubmissions(selectedAchievement.achievementId)} className="underline">Thử lại</button></div>}
            <div className="mt-4"><UnderlineTabs label="Chi tiết thành tích" value={detailTab} onChange={setDetailTab} items={[
              {id: 'INFO', label: 'Thông tin & Minh chứng', icon: FileText},
              {id: 'HISTORIES', label: `Lịch sử thẩm định (${histories.length})`, icon: History},
              {id: 'SUBMISSIONS', label: `Lần nộp & Snapshot (${submissions.length})`, icon: Layers},
            ]} /></div>

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
                    {canAct(selectedAchievement, 'manageEvidence') && (
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

                            {canAct(selectedAchievement, 'manageEvidence') && (
                              <>
                                <label
                                  title="Thay tệp mới (tăng phiên bản)"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                                >
                                  <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Thay file</span>
                                  <input
                                    type="file"
                                    disabled={evidenceSubmitting}
                                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadFileVersion(ev.evidenceId, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>

                                <button
                                  type="button"
                                  disabled={evidenceSubmitting}
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
                          Người thực hiện: <strong className="text-slate-900 dark:text-white">{h.actor?.displayName || h.actorName || `User #${h.actor?.userId ?? h.actorId}`}</strong>
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
                              Người nộp: <strong className="text-slate-800 dark:text-white">
                                {sub.submitterName || (typeof sub.submittedBy === 'object' ? sub.submittedBy?.displayName || sub.submittedBy?.email || `User #${sub.submittedBy?.userId}` : `User #${sub.submittedBy}`)}
                              </strong>
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>

                        {(snap.note || snap.submitNote) && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Ghi chú nộp: </span>
                            {snap.note || snap.submitNote}
                          </div>
                        )}

                        {/* Snapshot metadata */}
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-slate-400">Tiêu đề:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.title}</strong></div>
                          <div><span className="text-slate-400">Chủ thể:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.subjectType}</strong></div>
                          <div><span className="text-slate-400">Năm ghi nhận:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.recognitionYear}</strong></div>
                          <div><span className="text-slate-400">Phiên bản lúc nộp:</span> <strong className="text-slate-800 dark:text-slate-200">{snap.version != null ? `v${snap.version}` : 'Chưa ghi nhận'}</strong></div>
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
                                const file = evItem.file || evItem.files?.[0] || {};
                                const fileId = file.evidenceFileId || file.fileId;
                                const fileName = file.originalFileName || file.fileName || 'Tệp minh chứng';
                                return (
                                  <div
                                    key={evItem.evidenceId}
                                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                                  >
                                    <div className="truncate">
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{evItem.title}</span>
                                      <span className="text-slate-400 ml-2">({fileName} - v{file.versionNo || 1})</span>
                                    </div>
                                    {fileId && (
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadFile(fileId, fileName)}
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

      {/* 6. Modal AI Vision Certificate OCR */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-soft-2xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <span>✨ Quét AI Bằng khen & Chứng chỉ</span>
              </h2>
              <button
                onClick={() => { setAiModalOpen(false); setAiFile(null); setAiPreview(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tải lên ảnh chụp hoặc tệp PDF bằng khen, chứng chỉ. AI Vision sẽ tự động phân tích và điền tiêu đề, năm công nhận, ngày cấp, đơn vị cấp và số quyết định. Tệp sẽ được tự động đính kèm vào minh chứng.
              </p>

              {!aiFile ? (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-teal-300 dark:border-teal-700 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/40 transition">
                  <UploadCloud className="w-10 h-10 text-teal-600 dark:text-teal-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Kéo thả hoặc chọn tệp bằng khen</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hỗ trợ JPG, PNG hoặc PDF (Tối đa 10 MB)</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="sr-only"
                    onChange={(e) => handleAiFileSelect(e.target.files?.[0])}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                    {aiPreview ? (
                      <div className="relative max-h-48 overflow-hidden rounded-xl flex items-center justify-center bg-black/5">
                        <img src={aiPreview} alt="Xem trước bằng khen" className="object-contain max-h-48 rounded-lg" />
                        {aiScanning && (
                          <div className="absolute inset-0 bg-teal-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                            <div className="relative w-full h-1 bg-teal-400/80 animate-pulse mb-3" />
                            <RefreshCw className="w-8 h-8 animate-spin text-teal-300 mb-2" />
                            <span className="text-xs font-semibold tracking-wide">AI Vision đang quét tài liệu...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-2">
                        <FileText className="w-8 h-8 text-teal-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{aiFile.name}</p>
                          <p className="text-[11px] text-slate-500">{(aiFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        {aiScanning && <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Tệp đã chọn: <strong>{aiFile.name}</strong></span>
                    {!aiScanning && (
                      <button
                        type="button"
                        onClick={() => { setAiFile(null); setAiPreview(null); }}
                        className="text-rose-500 hover:underline"
                      >
                        Chọn tệp khác
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  disabled={aiScanning}
                  onClick={() => { setAiModalOpen(false); setAiFile(null); setAiPreview(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!aiFile || aiScanning}
                  onClick={handleAiExtract}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-soft-sm"
                >
                  {aiScanning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang quét AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Bắt đầu quét bằng AI Vision</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
