🛠 Tool Gán Tag Scenario POS (Đa Ngôn Ngữ)
Công cụ hỗ trợ Tester gán Tag nghiệp vụ phân cấp (6 tầng) cho các Test Case. Hỗ trợ tra cứu giải thích bằng Tiếng Việt và Tiếng Anh để người không biết tiếng Nhật vẫn có thể sử dụng chính xác.

📋 Tính năng chính
Phân cấp thông minh: Tự động lọc danh sách Tag con dựa trên Tag cha đã chọn (6 cấp).

Tra cứu đa ngôn ngữ: Hiển thị giải thích nghiệp vụ Tiếng Việt/Tiếng Anh ngay khi chọn Tag Nhật.

Tìm kiếm nhanh: Hỗ trợ tìm Tag bằng từ khóa tiếng Việt hoặc tiếng Nhật.

Trích xuất Test Case: Tự động nhận diện mã TC từ file log/txt.

Xuất báo cáo: Xuất kết quả mapping ra file .csv chuẩn UTF-8 (không lỗi font).

🚀 Hướng dẫn cài đặt
1. Yêu cầu hệ thống
Python: Phiên bản 3.10 trở lên (Đã test ổn định trên Python 3.14).

Thư viện hỗ trợ: pandas, openpyxl (để đọc file Excel).

2. Cài đặt thư viện
Mở Terminal/Command Prompt và chạy lệnh sau:

Bash

pip install pandas openpyxl
📂 Cấu trúc thư mục chuẩn
Để tool chạy đúng, bạn cần sắp xếp các file trong cùng một thư mục như sau:

main.py: File code Python chính.

tags_master.xlsx: File chứa cấu trúc Tag phân cấp (6 cột tiếng Nhật).

dictionary.xlsx: File từ điển (Cột A: Nhật, Cột B: Việt, Cột C: Anh).

testcase_list.txt: File chứa nội dung log hoặc danh sách mã TC cần gán tag.

📖 Hướng dẫn sử dụng
Bước 1: Chuẩn bị dữ liệu
Đảm bảo mã Test Case trong file .txt có định dạng TC_XXX.

Đảm bảo file dictionary.xlsx đã cập nhật đủ nghĩa tiếng Việt cho các Tag Nhật tương ứng.

Bước 2: Chạy chương trình
Bash

python main.py
Bước 3: Gán Tag
Chọn Test Case: Chọn mã TC ở khung đầu tiên.

Tìm kiếm/Chọn Tag: * Sử dụng thanh Search nếu muốn tìm nhanh theo nghĩa tiếng Việt.

Hoặc chọn lần lượt từ Cấp 1 đến Cấp 6 ở khung giữa.

Kiểm tra nghiệp vụ: Đọc phần giải thích hiện ra ở khung màu xanh để chắc chắn chọn đúng Tag.

Thêm Tag: Nhấn THÊM TAG VÀO TC.

Bước 4: Xuất kết quả
Nhấn XUẤT FILE MAPPING (.CSV) để lưu lại thành quả làm việc.

⚠️ Lưu ý quan trọng
Lỗi font: Khi mở file CSV kết quả bằng Excel, hãy mở bằng cách: Data -> From Text/CSV -> Chọn file -> Chọn File Origin: 65001: Unicode (UTF-8) để không bị lỗi tiếng Việt/Nhật.

Khớp dữ liệu: Chữ tiếng Nhật trong file dictionary.xlsx phải khớp hoàn toàn (không thừa khoảng trắng) với file tags_master.xlsx.
