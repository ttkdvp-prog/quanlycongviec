# Kịch bản sử dụng — `$dashboard-sheets-expert`

Tài liệu này liệt kê các tình huống mà agent nên auto-load skill `dashboard-sheets-expert`. Mỗi kịch bản có:

- **User nói gì** (cách user thường diễn đạt yêu cầu, kể cả tiếng Việt lẫn tiếng Anh).
- **Agent làm gì** (skill được kích hoạt, file nào được đọc, asset nào được copy).
- **Kết quả mong đợi** (deliverable cụ thể).

---

## 1. Khởi tạo dashboard mới từ con số 0

**User nói:**
- "Tạo cho tôi một dashboard quản trị có sidebar và topbar, responsive cho cả điện thoại."
- "Build a new admin panel with Google Sheet làm database."
- "Mình muốn dựng một trang admin để quản lý sản phẩm, dùng Google Sheet."

**Agent làm:**
1. Đọc `SKILL.md` → xác nhận match.
2. Đọc `references/responsive-layout.md` để nắm shell pattern.
3. Copy toàn bộ `assets/dashboard-shell/react/` vào project (hoặc `vanilla/` nếu user muốn no-build).
4. Copy `assets/shared-table/` vào `src/components/shared-table/`.
5. Copy `assets/apps-script/Code.gs` + `appsscript.json` để user paste vào Apps Script editor.
6. Hướng dẫn user tạo Google Sheet, set Script Properties (`API_KEY`, `SPREADSHEET_ID`), deploy Web App, paste URL vào `.env`.
7. Chạy `pnpm install && pnpm dev`.

**Kết quả:** Dashboard chạy được tại `localhost:5173`, có sẵn trang Overview + Products đọc dữ liệu thật từ Sheet.

---

## 2. Thêm một entity mới (ví dụ: Customers, Orders, Bookings)

**User nói:**
- "Thêm trang quản lý Customers, các cột là tên, email, ngày tạo, trạng thái."
- "Tạo thêm bảng Orders giống Products, có thêm cột tổng tiền và format VND."

**Agent làm:**
1. Đọc `references/shared-table-spec.md` để lấy column contract.
2. Tạo tab mới trong Google Sheet với các cột chuẩn (`id, name, ..., created_at, updated_at, version, deleted`).
3. Tạo file `pages/CustomersPage.tsx` hoặc `OrdersPage.tsx` clone từ `ProductsPage.tsx`, đổi `Entity` type và mảng `columns`.
4. Add route trong `main.tsx` và nav item trong `AppShell.tsx`.
5. Apps Script không cần sửa — `Code.gs` đã generic theo `table` param.

**Kết quả:** Trang mới list/search/sort/paginate/edit/delete đầy đủ, không phải viết lại table.

---

## 3. Format giá tiền VND, format ngày, badge trạng thái

**User nói:**
- "Cột giá phải hiện ₫ 1.200.000 không có số lẻ."
- "Trạng thái phải hiện badge màu xanh khi active, vàng khi draft."
- "Ngày phải format theo locale Việt Nam."

**Agent làm:**
- Thêm `format: "price"` + `currency: "VND"` cho column giá. Formatter mặc định đã set `maximumFractionDigits: 0` cho VND.
- Thêm `format: "badge"` cho column status; tone map đã có sẵn `active/draft/archived/success/warning/danger/neutral`.
- Thêm `format: "datetime"` cho cột thời gian; `Intl.DateTimeFormat("vi-VN")` được áp tự động.

**Kết quả:** Hiển thị đúng UX Việt Nam, không cần custom render.

---

## 4. Truncate mô tả dài thành 2 dòng có ellipsis + tooltip

**User nói:**
- "Cột mô tả dài quá, cho tôi giới hạn 2 dòng và bỏ ba chấm."
- "Khi hover thì hiện full text."

**Agent làm:**
- Set `clamp: 2` cho column. Component đã wrap nội dung trong `.cell-clamp` với `-webkit-line-clamp: var(--clamp)`.
- Khi `body` là string, `<div title={body}>` được set tự động → tooltip native khi hover.

**Kết quả:** Đúng line-clamp 2 dòng, không vỡ layout, tooltip có sẵn.

---

## 5. Click "Xem chi tiết" mở overlay sửa được dữ liệu

**User nói:**
- "Click vào một dòng phải mở overlay bên phải để xem và edit."
- "Trên điện thoại thì overlay phải full màn hình."
- "Edit xong save về Sheet luôn."

**Agent làm:**
- `RowDetailOverlay` có sẵn: slide-over phải trên desktop (`min(560px, 100vw)`), full màn hình dưới `@sm/main`.
- Truyền `onEdit={async (row, patch) => api.update(...)}` từ page → table → overlay.
- Optimistic update: patch áp vào local state ngay khi save, lỗi thì revert.

**Kết quả:** UX edit mượt, không reload trang, không mất context.

---

## 6. Xác nhận xóa bằng toast Undo (không dùng modal)

**User nói:**
- "Khi xóa phải có popup xác nhận."
- "Tôi muốn kiểu Gmail — xóa xong có nút Undo trong 5 giây."

**Agent làm:**
- Page truyền `onDelete={async (row) => api.remove(...)}`.
- `DataTable` đã wire sẵn pattern: setState xóa local ngay, `setTimeout` 5s mới gọi API thật, `sonner` toast với button `Undo` để clear timeout.

**Kết quả:** Tốc độ tâm lý tốt hơn modal (không chặn flow), vẫn an toàn nhờ delay 5s.

---

## 7. Stream dữ liệu live từ Google Sheet

**User nói:**
- "Tôi muốn khi có người sửa Sheet thì dashboard tự cập nhật."
- "Bảng phải refresh mỗi 3 giây."
- "Tab ẩn thì không cần poll nhiều, đỡ tốn quota."

**Agent làm:**
1. Đọc `references/sheets-streaming.md`.
2. Dùng hook `useSheetStream("Products", { intervalMs: 3000 })`.
3. Hook tự gọi `action=stream&since=<lastVersion>`, merge by id, xử lý `deleted` flag, exponential backoff khi lỗi, đổi sang 30s khi `document.hidden`.
4. Apps Script `Code.gs` tăng `_meta!A2` mỗi lần ghi → cursor monotonic.

**Kết quả:** Bảng tự cập nhật khi Sheet thay đổi, không tốn quota khi tab ẩn.

---

## 8. Responsive khi mở/đóng sidebar trên tablet

**User nói:**
- "Khi tôi đóng sidebar, các card thống kê phải reflow lại 4 cột thay vì 2."
- "Bảng phải gọn lại khi width content nhỏ hơn 480px."

**Agent làm:**
- Đọc `references/responsive-layout.md`.
- Đảm bảo `<section>` content có `@container/main` (đã có sẵn).
- Dùng `@container main (min-width: ...)` thay vì `@media`. Stat-grid và `DataTable` đã có sẵn breakpoint container.
- `DataTable` với `responsive="auto"` tự đổi sang stacked card dưới `@sm/main`.

**Kết quả:** Layout phản ứng theo content width thật, không phụ thuộc viewport. Mở/đóng sidebar = layout reflow.

---

## 9. Sidebar đổi thành drawer trên điện thoại

**User nói:**
- "Trên iPhone phải có nút hamburger, mở ra menu trượt từ trái."
- "Bấm ra ngoài menu thì đóng lại."

**Agent làm:**
- `AppShell.tsx` đã có sẵn: sidebar `hidden md:flex`, hamburger `md:hidden`, drawer overlay với scrim click → close.
- Dùng `h-dvh` thay `h-screen` để né bug Safari iOS thanh địa chỉ.
- Padding `env(safe-area-inset-bottom)` cho toast (đã có trong vanilla, áp tương tự cho React khi cần).

**Kết quả:** UX mobile chuẩn, không vỡ layout khi xoay máy.

---

## 10. Sort, search, pagination

**User nói:**
- "Click header để sort tăng/giảm."
- "Có ô search lọc theo tên/mô tả."
- "Mỗi trang 25 dòng, có nút Prev/Next."

**Agent làm:**
- Sẵn có trong `DataTable`: click header toggle `asc → desc → none`, search debounce 250ms, pageSize selector `[10, 25, 50, 100]`.
- Có 2 mode: client (truyền `data`) và server (truyền `fetcher` để gọi `api.list` với `q/sort/offset/limit`). Mặc định client; chuyển sang server khi data > 5k dòng.

**Kết quả:** Không phải code thêm gì, chỉ truyền data hoặc fetcher.

---

## 11. Apps Script làm backend, không lộ key ra client

**User nói:**
- "Tôi không muốn frontend gọi trực tiếp Sheets API."
- "API key phải bảo vệ."
- "Backend phải check auth."

**Agent làm:**
- Đọc `references/apps-script-backend.md`.
- `Code.gs` đã: `requireApiKey_` so sánh với `PropertiesService.getScriptProperties().getProperty("API_KEY")`.
- Client gửi `apiKey` trong body POST hoặc query GET (Apps Script không expose custom header tin cậy).
- POST dùng `Content-Type: text/plain` để né CORS preflight (Apps Script Web App không xử lý OPTIONS).

**Kết quả:** Key chỉ ở `.env` (build-time) và Script Properties (server-side). Không có credential trong source.

---

## 12. Soft-delete + audit version

**User nói:**
- "Xóa nhưng vẫn giữ lại bản ghi để khôi phục sau."
- "Cần biết dòng nào sửa lúc nào."

**Agent làm:**
- Mỗi sheet có column `deleted` (TRUE/FALSE) + `version` + `updated_at`.
- `action=delete` chỉ set `deleted=TRUE` + bump version + cập nhật `updated_at`.
- `list` mặc định lọc `deleted=TRUE`.

**Kết quả:** Có thể restore bằng cách sửa `deleted` về FALSE; có audit log cơ bản.

---

## 13. Khi user đã có project sẵn, không muốn scaffold lại

**User nói:**
- "Project tôi đã có Next.js rồi, chỉ cần cái shared table + Apps Script backend thôi."

**Agent làm:**
- Bỏ qua `assets/dashboard-shell/`.
- Copy chỉ `assets/shared-table/` vào `components/shared-table/`.
- Copy `assets/apps-script/Code.gs` để user deploy.
- Sửa `apiClient.ts` để dùng env style của project (Next.js: `process.env.NEXT_PUBLIC_*` thay `import.meta.env.VITE_*`).

**Kết quả:** Tích hợp được vào codebase có sẵn, không phá kiến trúc.

---

## 14. User cần version no-build (chạy trực tiếp trong Apps Script HTML Service)

**User nói:**
- "Tôi không muốn dựng Vite, build, deploy. Cho tôi 1 file HTML chạy trực tiếp trong Apps Script."

**Agent làm:**
- Copy `assets/dashboard-shell/vanilla/index.html`.
- Trong Apps Script project, thêm file `Index.html`, paste nội dung.
- Thêm hàm `doGet` trả về `HtmlService.createTemplateFromFile("Index").evaluate()` (hoặc nếu deploy chung Code.gs, tách 2 deployment: `/api` cho data, `/ui` cho HTML).
- Thay `PASTE_WEB_APP_URL_HERE` và `PASTE_API_KEY_HERE` trong file HTML.

**Kết quả:** Một file duy nhất, không có build step, hosted free trên Google.

---

## 15. Khi user mô tả mơ hồ → agent vẫn nhận diện được

**User nói:**
- "Tôi cần một trang admin có table đẹp."
- "Build cái CRUD UI cho mình."
- "Làm cái gì đó để xem dữ liệu Google Sheet trên web."

**Agent làm:**
- Match keyword `admin`, `table`, `CRUD`, `Google Sheet on web` → load skill.
- Hỏi tối thiểu: "Bạn muốn React (Vite) hay 1 file HTML no-build? Tên entity đầu tiên là gì?"
- Default sang React + entity `Products` nếu user không chỉ định.

**Kết quả:** Không phải mô tả lại spec, agent tự lo phần còn lại.

---

## Nguyên tắc quyết định

| Tình huống | Skill có activate? |
|---|---|
| User nhắc "dashboard", "admin panel", "shared table", "Google Sheet backend" | Có |
| User nhắc "table có sort/search/pagination" | Có |
| User nhắc "stream từ Google Sheet", "live update từ Sheet" | Có |
| User nhắc "Apps Script doGet/doPost" | Có |
| User nhắc "format giá tiền", "truncate text trong cell" trong context của bảng | Có |
| User chỉ hỏi "format Intl.NumberFormat thế nào" (không có context dashboard) | Không, trả lời trực tiếp |
| User cần realtime sub-second (chat, game) | Không, skill này dùng polling — đề xuất Firebase/WebSocket |
| User cần dataset > 100k rows | Có, nhưng warn quota Apps Script và đề xuất pagination server-side |
