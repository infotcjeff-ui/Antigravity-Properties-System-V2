import { redirect } from 'next/navigation';

/** 已合併至「管理業主」(/dashboard/tenants)，第一個分頁為業主／承租人列表 */
export default function ProprietorsPageRedirect() {
    redirect('/dashboard/tenants');
}
