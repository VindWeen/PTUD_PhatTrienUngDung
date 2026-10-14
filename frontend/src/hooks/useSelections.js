import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { selectionsApi } from '../services/selectionsApi';

const empty = {units:[],workflowUnits:[],subjectUnits:[],lecturers:[],awardTypes:[],achievementTypes:[],academicYears:[],decisions:[],users:[]};
export function useSelectionOptions(purpose,enabled=true) {
  const {user} = useAuth();
  const [data,setData] = useState(empty);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v+1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(empty);
    if(!enabled){setLoading(false);return;}
    selectionsApi.options(purpose).then(out => { if(active) setData(out); })
      .catch(e => { if(active) setError(e.message || 'Không tải được danh sách lựa chọn'); })
      .finally(() => { if(active) setLoading(false); });
    return () => {active=false;};
  },[purpose,user?.userId,revision,enabled]);
  return { ...data,loading,error,refresh };
}

export function useSelectionSources(purpose,subjectType,subjectId) {
  const {user} = useAuth();
  const [data,setData] = useState({achievements:[],awardRecords:[]});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let active=true;
    setData({achievements:[],awardRecords:[]}); setError('');
    if (!subjectId) {setLoading(false);return;}
    setLoading(true);
    selectionsApi.sources(purpose,subjectType,subjectId).then(out=>{if(active)setData(out);})
      .catch(e=>{if(active)setError(e.message || 'Không tải được hồ sơ nguồn');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[purpose,subjectType,subjectId,user?.userId]);
  return {...data,loading,error};
}
