import { redirect } from 'next/navigation';

/** 已合併至「管理業主」(/dashboard/tenants)，含業主與承租人分頁 */
export default function ProprietorsPageRedirect() {
    redirect('/dashboard/tenants');
}
