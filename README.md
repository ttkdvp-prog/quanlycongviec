# QLCV TTHT - Ứng dụng Web Quản lý Công việc & Hồ sơ Đơn vị

Ứng dụng Web Single-Page Application (SPA) Quản lý Công việc & Hồ sơ Đơn vị hiện đại, giao diện Dark Theme Glassmorphic, kết nối Google Sheets Database qua Google Apps Script REST API.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Giao diện 9 Tab chuyên nghiệp**:
   - **Tab 1: Tổng quan (Dashboard)**: Thống kê KPI, Biểu đồ Donut Chart (Chart.js), công việc ưu tiên cao.
   - **Tab 2: Bảng Kanban**: Kéo & Thả (Drag & Drop) chuyển trạng thái công việc mượt mà và tự động đồng bộ Google Sheets.
   - **Tab 3: Danh sách (List View)**: Hiển thị 100% dữ liệu từ Sheet `QLCV`, hỗ trợ bộ lọc thông minh & Chỉnh sửa trực tiếp trên bảng (Inline Editing với Debounce 500ms).
   - **Tab 4: Tổ trưởng giao việc**: Quản lý độc lập công việc giao nội bộ từ Sheet `TT_giaoviec`.
   - **Tab 5: Quản lý tài liệu**: Quản lý danh mục Hồ sơ, Hợp đồng, Hiệu lực và Liên kết file.
   - **Tab 6: Quản lý người dùng**: Danh mục nhân sự và phân tổ công tác từ Sheet `user`.
   - **Tab 7: Thống kê theo tổ**: Tổng hợp báo cáo tiến độ và tỷ lệ hoàn thành theo Tổ chủ trì.
   - **Tab 8: Đánh giá cá nhân**: Đánh giá và xếp loại tự động (A: Xuất sắc, B: Tốt, C: Đạt, D: Chưa đạt).
   - **Tab 9: Công việc lưu ý**: Danh mục công việc cần theo dõi đặc biệt (`cvluuy`).

2. **Ràng buộc nghiệp vụ cố định**:
   - **Lãnh đạo Trung tâm**: Khống chế duy nhất 3 Lãnh đạo trong Modal Form: `Nguyễn Công Hoan`, `Nguyễn Minh Cường`, `Nguyễn Trung Kiên`.
   - **Gợi ý Nhân sự Ưu tiên 3 cấp**: Tìm kiếm và chọn NV (A, R, C) ưu tiên Tổ trưởng/Tổ phó tổ chọn $\rightarrow$ Nhân viên trong tổ $\rightarrow$ Tất cả nhân viên còn lại.
   - **Tự động điền NV (A)**: Mặc định tự động điền Tên Tổ trưởng/Tổ phó khi chọn Tổ chủ trì (AR).

---

## 🚀 HƯỚNG DẪN TRIỂN KHAI 2 CHẾ ĐỘ

### CHẾ ĐỘ 1: CHẠY TRỰC TIẾP TRÊN GOOGLE APPS SCRIPT (HTML SERVICE)
1. Mở dự án Google Apps Script liên kết với Google Sheets `1-9-4G5wZUzqmGey5Dn5ys-iDW0jfJScLnC6sE9S3Cs4`.
2. Tạo tệp mã `Code.gs` và dán nội dung từ tệp `Code.gs`.
3. Tạo tệp HTML `index.html` và dán nội dung `index.html`.
4. Nhấn **Deploy (Triển khai)** $\rightarrow$ **New deployment (Triển khai mới)** $\rightarrow$ Chọn loại **Web app**.
5. Cấu hình:
   - **Execute as**: `Me` (Tôi)
   - **Who has access**: `Anyone` (Bất kỳ ai)
6. Nhấn **Deploy** và mở URL Web App để trải nghiệm.

---

### CHẾ ĐỘ 2: CHẠY ĐỘC LẬP TRÊN VERCEL / HOSTING / LOCALHOST
1. Triển khai `Code.gs` thành Apps Script Web App và sao chép URL Web App dạng `https://script.google.com/macros/s/.../exec`.
2. Đưa bộ mã nguồn (`index.html`, `style.css`, `app.js`) lên Vercel, Netlify hoặc Web Server của bạn.
3. Mở ứng dụng web, click nút **Bánh răng Cấu hình (Settings)** ở góc trên bên phải.
4. Dán URL Web App Exec vào ô cấu hình và chọn **Lưu cấu hình**.
5. Ứng dụng sẽ kết nối trực tiếp với Google Sheets qua REST API!
