# THINK & MATCH – SKECHERS

Game lật ô hai đội do MC điều khiển: vòng chính 4×4 (8 cặp, 24 câu chính + 6 câu dự phòng), vòng phụ khi hòa, câu ước lượng, ảnh ẩn, song ngữ VI/EN.

## Cấu trúc
- `public/`: toàn bộ ứng dụng (HTML, CSS, JS thuần, ảnh mặc định, manifest PWA, service worker).
- `scripts/build.js`: chép `public/` sang `dist/` và kiểm tra tệp.
- `vercel.json`: cấu hình deploy (build `npm run build`, output `dist`).
- `docs/HUONG_DAN_THINK_AND_MATCH.md`: hướng dẫn vận hành cho MC.

## Chạy và build
```
npm run build      # tạo dist/
npm start          # xem thử tại http://localhost:3000
```
Không có thư viện phụ thuộc, không cần biến môi trường.

## Dữ liệu
Cài đặt, câu hỏi, ảnh tải lên và tiến độ trận lưu trong `localStorage`; nhạc nền và fanfare lưu trong IndexedDB. Dữ liệu gắn với trình duyệt và tên miền đang mở, nên hãy cài đặt trên chính máy trình chiếu.
