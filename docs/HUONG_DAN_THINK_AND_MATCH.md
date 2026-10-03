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
5. Vào **Cài đặt → Tài khoản** để tạo thêm tài khoản MC nếu cần.

Mật khẩu do Supabase lưu dạng mã hóa, không nằm trong mã trang web. Mọi thao tác quản trị đều được máy chủ kiểm tra quyền. Người chưa đăng nhập mở thẳng `/admin` chỉ thấy màn hình đăng nhập.

## 1. Quyền của từng vai trò
- **Admin**: có mọi quyền của MC, cộng thêm thêm/sửa/xóa câu hỏi, nhập/xuất ngân hàng câu hỏi và quản lý tài khoản.
- **MC**: điều khiển trận, sửa tên chương trình, tên đội, thời gian, ngôn ngữ, hình ảnh, nhạc, và chọn câu hỏi khi chơi.
- **Màn hình người chơi**: chỉ xem tên chương trình, đội, điểm, đồng hồ, câu hỏi đã công bố, kết quả, bảng ô và hiệu ứng. Trang này không bao giờ nhận đáp án chưa công bố hay vị trí hình ẩn.

## 2. Giao diện: trong sao ngoài vậy
- Trang MC và màn hình trình chiếu dùng **cùng một giao diện** (giống bản trước): màn hình chào, màn hình chơi, màn hình kết quả.
- Trang MC chỉ khác ở chỗ có các nút điều khiển:
  - Màn hình chào: **BẮT ĐẦU** (hoặc **TIẾP TỤC** khi đang có trận), **Chơi thử**, **Cài đặt**.
  - Màn hình chơi: khung **ĐIỀU KHIỂN MC** bên phải (màn hình trình chiếu hiện khung thông báo ở cùng vị trí), và hàng nút góc trên: ngôn ngữ, nhạc nền, âm thanh trên máy này, tạm dừng, toàn màn hình, mở màn hình trình chiếu, **Cài đặt** (bánh răng), về màn hình chào.
  - Màn hình kết quả: Phát lại hiệu ứng, Chơi lại, Về màn hình chào.
- MC bấm gì thì màn hình trình chiếu đổi theo ngay (về màn hình chào, vào trận, kết quả). Khung MC có đáp án nhưng màn hình trình chiếu không bao giờ nhận đáp án chưa công bố.
- **Chơi thử**: bấm trên màn hình chào, chơi một lượt trên bảng 4 ô không tính điểm, rồi bấm **KẾT THÚC CHƠI THỬ** để quay lại màn hình chính.

## 3. Mở màn hình trình chiếu
- Bấm biểu tượng màn hình ở góc trên trang MC (hoặc **Cài đặt → Mở màn hình trình chiếu**). Kéo cửa sổ mới sang máy chiếu rồi bấm biểu tượng toàn màn hình (hoặc nhấp đúp).
- Hoặc mở `https://www.skechjoy.com` trên một máy khác nối với máy chiếu.
- Bấm vào màn hình trình chiếu một lần để trình duyệt cho phép phát âm thanh. Trang MC mặc định tắt tiếng để không bị vọng âm; bấm biểu tượng loa nếu muốn nghe trên máy MC.
- Đóng rồi mở lại cửa sổ, hay mất mạng rồi có mạng lại, màn hình vẫn hiện đúng trạng thái trận. Chấm ở góc dưới bên phải: xanh là đồng bộ trực tiếp, vàng là đồng bộ dự phòng, đỏ là mất kết nối.

## 4. Trang Cài đặt
Bấm **Cài đặt** để mở trang chỉnh hệ thống, bấm **Về màn hình chính** để quay lại:
- **Chương trình, đội, thời gian, hình, nhạc**: tên chương trình, khẩu hiệu, ngôn ngữ, tên và màu đội, thời gian từng vòng, logo, ảnh nền, 15 hình giày, nhạc nền, nhạc chiến thắng. Nhớ bấm **Lưu cài đặt**.
- **Câu hỏi**: ngân hàng câu hỏi (xem mục 7).
- **Màn hình cảm ứng**: chọn ai bấm ô (MC hay người chơi chạm màn hình) và ghép nối màn hình cảm ứng.
- **Tài khoản**: tài khoản đang dùng, nút Đăng xuất; Admin thêm/gỡ tài khoản MC tại đây.
- **Lịch sử trận**: các trận đã chơi.

## 5. Chọn ô: MC bấm hay người chơi chạm
- **MC bấm ô (mặc định)**: người chơi đọc số ô, MC bấm ô đó trên bảng của trang MC. Màn hình trình chiếu lật ô ngay.
- **Người chơi chạm màn hình cảm ứng** (Cài đặt → Màn hình cảm ứng):
  1. Bấm **Tạo mã ghép nối**. Mã có 6 số, dùng được trong 10 phút.
  2. Trên màn hình cảm ứng, bấm biểu tượng bàn tay ở góc trên rồi nhập mã.
  3. Chỉ màn hình đã ghép nối mới chọn được ô, và chỉ sau khi MC chấm **Đúng**. Máy chủ kiểm tra tối đa 2 ô mỗi lượt. Mất kết nối thì tạm khóa chọn ô đến khi đồng bộ lại.
  4. Bấm **Hủy ghép nối** để thu hồi quyền của màn hình đó.

## 6. Điều khiển một lượt (vòng chính)
1. Trên màn hình chào bấm **BẮT ĐẦU**. Hộp thoại cảnh báo nếu thiếu câu hỏi, đáp án hoặc hình. Nhập tên hai đội, chọn đội đi trước, bấm **Vào trận**. Vị trí hình được đảo tự động.
2. Trong khung ĐIỀU KHIỂN MC, bấm **BẮT ĐẦU VÒNG CHÍNH**.
3. Bấm số câu hỏi. Nội dung và đáp án chỉ hiện trong khung MC; màn hình trình chiếu hiện “Mời đội … chuẩn bị”.
4. Bấm **BẮT ĐẦU TÍNH GIỜ**: câu hỏi hiện lên màn hình trình chiếu và đồng hồ trả lời chạy.
5. Dùng một trong ba nút:
   - **XEM ĐÁP ÁN**: dừng giờ và hiện “Đáp án: …”. Chưa chấm điểm, chưa cho lật ô.
   - **ĐÚNG**: hiện “Chính xác: …” và “Mời đội … lật 2 ô!”, rồi chạy đồng hồ lật ô. MC bấm 2 ô trên bảng (hoặc người chơi chạm nếu dùng màn hình cảm ứng).
   - **SAI**: hiện “Chưa chính xác! Đáp án đúng: …”, không cho lật ô và chuyển lượt.
6. Kết quả lật ô:
   - Trúng cặp: +1 điểm, hai ô biến mất và lộ ảnh nền.
   - Không trúng: hai ô mở trong thời gian ghi nhớ, hiện dấu X rồi úp lại.
   - Hết giờ lật: ô úp lại, không có điểm.
7. Phía dưới khung MC: tạm dừng/tiếp tục đồng hồ vòng chính, thêm câu bổ sung, **Chỉnh điểm** (hiện nút +/− trên thẻ đội), **Đảo hình**, **Kết thúc vòng**.
8. Nút về màn hình chào (ngôi nhà) sẽ tạm dừng đồng hồ. Bấm **TIẾP TỤC** trên màn hình chào để vào lại trận, rồi bấm **▶ Tiếp tục**.

## 7. Vòng phụ và câu ước lượng
- Khi hòa điểm, bấm **BẮT ĐẦU VÒNG PHỤ**, chọn câu, bấm **CÔNG BỐ CÂU HỎI**, rồi bấm tên đội giành quyền trả lời.
- Nếu đội đầu trả lời sai, đội còn lại được trả lời cùng câu. Trong lúc đó đáp án được giữ kín và nút **Xem đáp án** bị khóa.
- Muốn công bố sớm, bấm “Bỏ qua quyền trả lời…”. Hệ thống sẽ hỏi xác nhận, vì thao tác này kết thúc quyền trả lời của cả hai đội.
- Khi hết giờ vòng phụ hoặc hết câu, game chuyển sang câu ước lượng: công bố câu, nhập đáp án hai đội, bấm **SO SÁNH**, rồi **CÔNG BỐ ĐỘI THẮNG**.

## 8. Đảo vị trí hình (Shuffle Board)
- Nút **Đảo hình** nằm phía dưới khung ĐIỀU KHIỂN MC. Trước khi vòng bắt đầu, bạn có thể bấm nhiều lần.
- Khi vòng đã bắt đầu, hệ thống hỏi xác nhận. Đảo hình sẽ chơi lại vòng hiện tại:
  - Ở vòng chính, điểm vòng chính bị xóa.
  - Ở vòng phụ, điểm vòng chính được giữ.
  - Câu hỏi và cài đặt không bị xóa.

## 9. Ngân hàng câu hỏi (Cài đặt → Câu hỏi)
- Có 4 nhóm: vòng chính, dự phòng, vòng phụ, ước lượng.
  - Mỗi câu có mã cố định, nội dung và đáp án Tiếng Việt/English.
  - Câu ước lượng có thêm đáp án số và đơn vị.
- Bạn có thể tìm kiếm, lọc theo nhóm, thêm, sửa, xóa (có xác nhận) và **Bật/Tắt** câu hỏi mà không cần xóa.
- Mỗi trận mới (bấm **BẮT ĐẦU** hoặc **Chơi lại**) chụp lại các câu đang Bật. Sửa ngân hàng giữa trận chỉ áp dụng cho trận sau.
  - Mỗi câu chỉ dùng một lần trong trận.
  - Trận mới thì dùng lại được cả bộ.
- Số câu không cố định: mặc định 24 câu chính, 6 dự phòng, 5 câu phụ, 3 câu ước lượng. Thêm hoặc tắt câu để thay đổi.
- Tùy chọn **Xáo trộn thứ tự câu hỏi khi tạo trận mới** độc lập với đảo vị trí hình.
- **Xuất JSON** để sao lưu. **Nhập JSON** có kiểm tra dữ liệu và cho chọn Gộp hoặc Thay thế toàn bộ (thay thế phải xác nhận thêm lần nữa).
- Xóa câu hỏi không làm mất lịch sử các trận đã chơi (Cài đặt → **Lịch sử trận**).

## 10. Bản offline dự phòng
Tệp `legacy-offline.html` là bản cũ chạy trên một máy, không có đăng nhập. Chỉ dùng khi không có mạng.
