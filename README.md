# THINK & MATCH – SKECHERS

Game lật ô hai đội do MC điều khiển: vòng chính 4×4 (8 cặp), vòng phụ khi hòa, câu ước lượng, song ngữ VI/EN.
Trang MC (`/admin`) có đăng nhập và phân quyền Admin/MC. Màn hình người chơi (`/`) chỉ hiển thị và đồng bộ theo thời gian thực.

## Kiến trúc
- `public/`: giao diện tĩnh.
  - `index.html` + `js/player.js`: màn hình người chơi.
  - `admin.html` + `js/admin.js`: trang MC.
  - `js/common.js`: phần dùng chung.
- `api/*.js`: hàm máy chủ trên Vercel (`state`, `config`, `auth`, `action`, `admin`, `device`).
- `lib/engine.js`: luật chơi và máy trạng thái. Máy chủ là nơi duy nhất quyết định đồng hồ, điểm và quyền lật ô.
- `lib/api.js`: kiểm tra đăng nhập và quyền cho mọi thao tác; ghi trạng thái có khóa phiên bản.
- `lib/backend.js`: lưu trữ trên Supabase (Postgres, Auth, Storage, Realtime), hoặc lưu trong bộ nhớ khi chạy thử.
- `supabase/schema.sql` (bản sao `public/setup.sql`): tạo bảng, bật RLS, tạo mã khởi tạo Admin.
- Bảo mật:
  - Màn hình người chơi chỉ đọc bảng `tm_public`, bảng này không chứa đáp án chưa công bố hay vị trí hình.
  - Khóa service role chỉ nằm trong biến môi trường của Vercel.

## Biến môi trường (Vercel)
Tích hợp Supabase trên Vercel tạo sẵn các biến này (có thể kèm tiền tố):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (hoặc `SUPABASE_SECRET_KEY`)
- `SUPABASE_ANON_KEY` (hoặc publishable key), dùng cho Realtime.

## Chạy thử trên máy (không cần Supabase)
```
npm start            # http://localhost:3000 (màn hình người chơi), /admin (MC), mã khởi tạo DEV12345
npm test             # kiểm tra luật chơi
npm run build        # tạo dist/ và kiểm tra tệp
```
`TM_DEV_DB=/đường/dẫn/db.json npm start` lưu dữ liệu chạy thử ra tệp.

Hướng dẫn vận hành: `docs/HUONG_DAN_THINK_AND_MATCH.md`.
