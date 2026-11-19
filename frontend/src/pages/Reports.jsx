import React from 'react';
import { Link } from 'react-router-dom';
import { array } from '../services/vaultApi';
import { useCollection } from '../hooks/useCollection';
import { Page } from '../components/common/VaultPage';
import { Empty, Load } from '../components/common/VaultPrimitives';
import { button, secondary, panel } from '../components/common/vaultStyles';

export function Reports() {
  const state = useCollection('/achievements');
  const items = array(state.data);
  const years = new Map();
  const types = new Map();
  for (const item of items) {
    const year = String(item.achievedAt || '').slice(0, 4) || 'Chưa rõ';
    const type = item.typeName || 'Chưa phân loại';
    years.set(year, (years.get(year) || 0) + 1);
    types.set(type, (types.get(type) || 0) + 1);
  }
  const yearly = [...years].sort(([a], [b]) => a.localeCompare(b));
  const categories = [...types].sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b, 'vi'));
  const maxAnnual = Math.max(1, ...years.values());

  return (
    <Page title="Thống kê & Báo cáo"
      description="Thành tích trong kho cá nhân của bạn, tổng hợp theo năm và loại."
      actions={<Link className={secondary} to="/achievements">Về kho thành tích</Link>}>
      <Load state={state}>
        {!items.length ? <section className={panel}>
          <Empty action={<Link className={button} to="/achievements">Về kho thành tích</Link>}>Chưa có dữ liệu để thống kê.</Empty>
        </section> : <>
          <p className="vault-summary"><strong>{items.length} thành tích</strong><span>Tính trên toàn bộ kho cá nhân</span></p>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="mb-3 text-lg font-bold">Thành tích theo năm</h2>
              <div className="vault-table-wrap"><table className="vault-table">
                <thead><tr><th scope="col">Năm</th><th scope="col">Số thành tích</th><th scope="col">Tỷ trọng</th></tr></thead>
                <tbody>{yearly.map(([year, count]) => <tr key={year}>
                  <th scope="row">{year}</th>
                  <td><strong>{count}</strong><div className="vault-report-track" aria-hidden="true"><span style={{ width: count / maxAnnual * 100 + '%' }} /></div></td>
                  <td>{Math.round(count / items.length * 100)}%</td>
                </tr>)}</tbody>
              </table></div>
            </section>
            <section className={panel}>
              <h2 className="mb-3 text-lg font-bold">Thành tích theo loại</h2>
              <ul className="space-y-4">{categories.map(([name, count]) => {
                const share = count / items.length * 100;
                return <li key={name}>
                  <div className="flex justify-between gap-2 text-sm"><span>{name}</span><strong className="shrink-0">{count} · {Math.round(share)}%</strong></div>
                  <div className="vault-report-track" aria-hidden="true"><span style={{ width: share + '%' }} /></div>
                </li>;
              })}</ul>
            </section>
          </div>
        </>}
      </Load>
    </Page>
  );
}
