# Supabase Migrations

## 今日更改所需的 SQL

**是的，需要在 Supabase 中執行 SQL。**

請在 Supabase Dashboard → SQL Editor 中執行以下遷移：

### 遷移檔：`migrations/20250316000000_sub_landlords_current_tenants.sql`

此遷移會建立：

1. **sub_landlords** 表 - 二房東（結構與出租合約相同）
2. **current_tenants** 表 - 現時租客（結構與出租合約相同）
3. **rents** 表新增欄位：
   - `rent_out_sub_landlord_id` (uuid)
   - `rent_out_tenant_ids` (jsonb)

執行後，二房東與現時租客資料會儲存於 admin 專用頁面：
- `/dashboard/sub-landlords` 管理二房東
- `/dashboard/current-tenants` 管理現時租客
