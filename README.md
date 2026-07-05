# Hướng Dẫn Triển Khai Phần Mềm Quản Lý Chấm Công Cá Nhân

Ứng dụng quản lý chấm công, trực ban, giám định cá nhân hàng tuần và hàng tháng, lưu trữ dữ liệu an toàn riêng biệt theo từng tháng dưới dạng tệp JSON.

## 🛠️ Cấu Hình Máy Chủ Cá Nhân (Ubuntu + Docker Compose + Tailscale)

Hệ thống được thiết kế tối ưu hóa cho cấu hình phần cứng có **02 ổ cứng**:
1. **SSD**: Chạy máy chủ Docker và mã nguồn ứng dụng (tối ưu hóa tốc độ tải và xử lý).
2. **HDD**: Lưu trữ dữ liệu lâu dài (tránh mất mát dữ liệu khi cài lại hệ điều hành hoặc Docker container gặp sự cố).

### 1. Chuẩn Bị Thư Mục Trên HDD Của Ubuntu
Đầu tiên, hãy tạo một thư mục chuyên dụng trên ổ cứng HDD vật lý của bạn (ví dụ HDD được gắn tại `/mnt/hdd`):

```bash
# Tạo thư mục lưu trữ dữ liệu chấm công trên HDD
sudo mkdir -p /mnt/hdd/attendance_data
# Cấp quyền ghi dữ liệu cho thư mục
sudo chmod -R 777 /mnt/hdd/attendance_data
```

### 2. Triển Khai Với Docker Compose
Tệp `docker-compose.yml` được định cấu hình sẵn để xuất ứng dụng ở cổng **3082** trên máy chủ lưu trữ (Ubuntu Host).

Chạy lệnh sau trong thư mục chứa mã nguồn để bắt đầu dựng và chạy container:

```bash
# Dựng và khởi động container ở chế độ nền (detached)
docker compose up -d --build
```

### 3. Cấu Hình Tailscale
Để truy cập an toàn từ xa qua mạng VPN Tailscale cá nhân của bạn:
1. Đảm bảo Tailscale đã được cài đặt và kích hoạt trên máy chủ Ubuntu:
   ```bash
   tailscale status
   ```
2. Tìm địa chỉ IP Tailscale của máy chủ Ubuntu (ví dụ: `100.x.y.z`).
3. Truy cập phần mềm từ bất kỳ thiết bị nào có kết nối Tailscale bằng trình duyệt:
   ```
   http://100.x.y.z:3082
   ```

---

## 📈 Tính Năng Nổi Bật Đã Triển Khai
1. **Xem và cập nhật theo Tuần**: Giao diện trực quan 7 ngày. Hỗ trợ click mở Popup khai báo nhanh Trực ban & Giám định vụ án.
2. **Quản lý Vụ Án Giám Định**: Tự động tổng hợp danh sách vụ án trong tháng, tự động phối màu tím từ đậm đến nhạt dựa trên chỉ số vụ án để dễ phân biệt.
3. **Khai báo Học tập & Nghỉ phép**: Cho phép thêm nhiều đợt trong tháng. Tự động chuyển màu khối Học (Xanh dương) và Nghỉ phép (Đỏ) trên cả lịch tuần và tháng, đồng thời tự động ghi đè và vô hiệu hóa phối các màu khác khi đã nghỉ/học.
4. **Lịch Tháng Thu Nhỏ**: Bao quanh tuần hiện tại bằng viền màu vàng/chàm nổi bật để dễ dàng định vị. Tự động "phối trộn" các dải màu (Xanh lá cho ngày làm việc, Vàng cho trực ban, Tím cho giám định) trực quan. Nhấp vào bất kỳ ngày nào trong lịch tháng sẽ lập tức chuyển Lịch Tuần lên trên để theo dõi chi tiết.
5. **Thống Kê Ngoài Giờ Tự Động**:
   - Số ngày trực ban cuối tuần trong tháng (Vàng + Thứ 7, Chủ Nhật).
   - Tổng số giờ Giám định ngoài giờ trong tháng.
   - Thanh tiến độ cộng dồn lũy kế Giám định ngoài giờ YTD từ tháng 1 đến tháng hiện tại so với hạn ngạch **300 giờ/năm** (Tự động reset về 0 khi sang năm mới).
6. **Lưu trữ độc lập theo Tháng**: Mọi thao tác được đồng bộ trực tiếp vào các tệp JSON có dạng `attendance-YYYY-MM.json` nằm trên thư mục HDD vật lý được liên kết, đảm bảo an toàn tuyệt đối cho dữ liệu.
