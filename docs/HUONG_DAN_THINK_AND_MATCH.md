# THINK & MATCH: hướng dẫn nhanh

Bản web có hai trang:
- **Trang MC/Admin**: `https://www.skechjoy.com/admin`. Trang này cần đăng nhập và dùng để điều khiển trận.
- **Màn hình người chơi**: `https://www.skechjoy.com`. Trang này chỉ hiển thị, không cần tài khoản, và đưa lên máy chiếu.

Hai trang đồng bộ qua máy chủ (Vercel + Supabase), nên có thể chạy trên hai máy khác nhau.

## 0. Cài đặt một lần (Admin)
1. Mở Supabase của dự án, chọn **SQL Editor** rồi **New query**.
2. Dán toàn bộ tệp `setup.sql` vào và bấm **Run**. Tệp nằm ở `https://www.skechjoy.com/setup.sql`, hoặc bấm nút **Sao chép SQL** trên trang /admin.
3. Dòng kết quả cuối là **MA_KHOI_TAO** (8 ký tự). Hãy ghi lại mã này.
4. Mở `/admin`, nhập mã khởi tạo, email và mật khẩu (ít nhất 8 ký tự) để tạo tài khoản Admin đầu tiên. Mã chỉ dùng được một lần.
5. Vào tab **Tài khoản** để tạo thêm tài khoản MC nếu cần.

Mật khẩu do Supabase lưu dạng mã hóa, không nằm trong mã trang web. Mọi thao tác quản trị đều được máy chủ kiểm tra quyền. Người chưa đăng nhập mở thẳng `/admin` chỉ thấy màn hình đăng nhập.

## 1. Quyền của từng vai trò
- **Admin**: có mọi quyền của MC, cộng thêm thêm/sửa/xóa câu hỏi, nhập/xuất ngân hàng câu hỏi và quản lý tài khoản.
- **MC**: điều khiển trận, sửa tên chương trình, tên đội, thời gian, ngôn ngữ, hình ảnh, nhạc, và chọn câu hỏi khi chơi.
- **Màn hình người chơi**: chỉ xem tên chương trình, đội, điểm, đồng hồ, câu hỏi đã công bố, kết quả, bảng ô và hiệu ứng. Trang này không bao giờ nhận đáp án chưa công bố hay vị trí hình ẩn.

## 2. Mở màn hình trình chiếu
- Trên trang MC, bấm **Mở màn hình người chơi**. Một cửa sổ mới mở ra; kéo cửa sổ đó sang máy chiếu rồi bấm biểu tượng toàn màn hình (hoặc nhấp đúp).
- Bạn cũng có thể mở `https://www.skechjoy.com` trên một máy khác nối với máy chiếu.
- Bấm vào màn hình người chơi một lần để trình duyệt cho phép phát âm thanh.
- Đóng rồi mở lại cửa sổ, hay mất mạng rồi có mạng lại, màn hình vẫn hiện đúng trạng thái trận đang chơi.
- Góc trên trang MC hiện tình trạng đồng bộ: **Đồng bộ trực tiếp** (xanh) là tốt nhất; **Mất kết nối** (đỏ) nghĩa là cần kiểm tra mạng.

## 3. Hai chế độ chọn ô (Điều khiển → Chế độ chọn ô)
- **Trình chiếu (mặc định)**: người chơi đọc số ô, MC bấm ô đó trên bảng thu nhỏ trong trang MC. Màn hình ngoài lật ô ngay.
- **Tương tác**: người chơi chạm trực tiếp vào màn hình cảm ứng.
  1. Trên trang MC, bấm **Tạo mã ghép nối**. Mã có 6 số, dùng được trong 10 phút.
  2. Trên màn hình cảm ứng, bấm biểu tượng bàn tay ở góc trên rồi nhập mã.
  3. Chỉ màn hình đã ghép nối mới chọn được ô, và chỉ sau khi MC chấm **Đúng**. Mọi màn hình khác chỉ xem.
  4. Máy chủ kiểm tra tối đa 2 ô mỗi lượt. Nếu màn hình mất kết nối, việc chọn ô tạm khóa đến khi đồng bộ lại.
  5. Bấm **Hủy ghép nối** để thu hồi quyền của màn hình đó.

## 4. Điều khiển một lượt (vòng chính)
1. Bấm **Trận mới**. Hộp thoại hiện số câu hỏi và cảnh báo nếu thiếu câu hỏi, đáp án hoặc hình. Nhập tên hai đội và chọn đội đi trước. Vị trí hình được đảo tự động.
2. Bấm **BẮT ĐẦU VÒNG CHÍNH**.
3. Chọn số câu hỏi. Nội dung và đáp án chỉ hiện trên trang MC; màn hình ngoài hiện “Mời đội … chuẩn bị”.
4. Bấm **BẮT ĐẦU TÍNH GIỜ**: câu hỏi hiện lên màn hình ngoài và đồng hồ trả lời chạy. Bấm nhiều lần cũng không tạo thêm đồng hồ.
5. Dùng một trong ba nút:
   - **Xem đáp án**: dừng giờ và hiện “Đáp án: …”. Chưa chấm điểm, chưa cho lật ô.
   - **Đúng**: hiện “Chính xác: …” và “Mời đội … lật 2 ô!”, rồi chạy đồng hồ lật ô. Đội chỉ được điểm khi lật trúng một cặp.
   - **Sai**: hiện “Chưa chính xác! Đáp án đúng: …”, không cho lật ô và chuyển lượt.
6. Kết quả lật ô:
   - Trúng cặp: +1 điểm, hai ô biến mất và lộ ảnh nền.
   - Không trúng: hai ô mở trong thời gian ghi nhớ, hiện dấu X rồi úp lại.
   - Hết giờ lật: ô úp lại, không có điểm.

## 5. Vòng phụ và câu ước lượng
- Khi hòa điểm, bấm **BẮT ĐẦU VÒNG PHỤ**, chọn câu, bấm **CÔNG BỐ CÂU HỎI**, rồi bấm tên đội giành quyền trả lời.
- Nếu đội đầu trả lời sai, đội còn lại được trả lời cùng câu. Trong lúc đó đáp án được giữ kín và nút **Xem đáp án** bị khóa.
- Muốn công bố sớm, bấm “Bỏ qua quyền trả lời…”. Hệ thống sẽ hỏi xác nhận, vì thao tác này kết thúc quyền trả lời của cả hai đội.
- Khi hết giờ vòng phụ hoặc hết câu, game chuyển sang câu ước lượng: công bố câu, nhập đáp án hai đội, bấm **SO SÁNH**, rồi **CÔNG BỐ ĐỘI THẮNG**.

## 6. Đảo vị trí hình (Shuffle Board)
- Nút **Đảo vị trí hình** nằm trong khung Trận đấu. Trước khi vòng bắt đầu, bạn có thể bấm nhiều lần.
- Khi vòng đã bắt đầu, hệ thống hỏi xác nhận. Đảo hình sẽ chơi lại vòng hiện tại:
  - Ở vòng chính, điểm vòng chính bị xóa.
  - Ở vòng phụ, điểm vòng chính được giữ.
  - Câu hỏi và cài đặt không bị xóa.

## 7. Ngân hàng câu hỏi (Admin)
- Có 4 nhóm: vòng chính, dự phòng, vòng phụ, ước lượng.
  - Mỗi câu có mã cố định, nội dung và đáp án Tiếng Việt/English.
  - Câu ước lượng có thêm đáp án số và đơn vị.
- Bạn có thể tìm kiếm, lọc theo nhóm, thêm, sửa, xóa (có xác nhận) và **Bật/Tắt** câu hỏi mà không cần xóa.
- **Trận mới** chụp lại các câu đang Bật. Sửa ngân hàng giữa trận chỉ áp dụng cho trận sau.
  - Mỗi câu chỉ dùng một lần trong trận.
  - Trận mới thì dùng lại được cả bộ.
- Số câu không cố định: mặc định 24 câu chính, 6 dự phòng, 5 câu phụ, 3 câu ước lượng. Thêm hoặc tắt câu để thay đổi.
- Tùy chọn **Xáo trộn thứ tự câu hỏi khi tạo trận mới** độc lập với đảo vị trí hình.
- **Xuất JSON** để sao lưu. **Nhập JSON** có kiểm tra dữ liệu và cho chọn Gộp hoặc Thay thế toàn bộ (thay thế phải xác nhận thêm lần nữa).
- Xóa câu hỏi không làm mất lịch sử các trận đã chơi (tab **Lịch sử**).

## 8. Bản offline dự phòng
Tệp `legacy-offline.html` là bản cũ chạy trên một máy, không có đăng nhập. Chỉ dùng khi không có mạng.
