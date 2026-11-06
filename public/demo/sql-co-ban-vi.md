# SQL cơ bản

SQL (Structured Query Language) là ngôn ngữ dùng để truy vấn và quản lý dữ liệu trong cơ sở dữ liệu quan hệ. Dữ liệu được lưu trong các bảng, mỗi bảng gồm nhiều hàng (bản ghi) và nhiều cột (thuộc tính). Người làm dữ liệu dùng SQL hằng ngày để lấy số liệu, kiểm tra chất lượng dữ liệu và chuẩn bị bảng cho phân tích.

## Câu lệnh SELECT

SELECT dùng để chọn các cột cần xem từ một bảng. Cú pháp cơ bản là SELECT tên_cột FROM tên_bảng. Dấu sao (*) nghĩa là lấy tất cả các cột, nhưng khi làm việc thật nên liệt kê rõ cột cần dùng để truy vấn nhanh và dễ đọc hơn. Từ khóa DISTINCT giúp loại bỏ các giá trị trùng lặp trong kết quả.

## Lọc dữ liệu với WHERE

Mệnh đề WHERE giữ lại những hàng thỏa điều kiện. Điều kiện có thể dùng các phép so sánh như bằng, lớn hơn, nhỏ hơn, và kết hợp bằng AND, OR, NOT. Toán tử IN kiểm tra giá trị nằm trong một danh sách, BETWEEN kiểm tra trong một khoảng, còn LIKE tìm chuỗi theo mẫu. Với giá trị thiếu, phải dùng IS NULL thay vì dấu bằng.

## Sắp xếp và giới hạn kết quả

ORDER BY sắp xếp kết quả theo một hoặc nhiều cột, tăng dần (ASC) hoặc giảm dần (DESC). Khi chỉ cần vài dòng đầu, dùng LIMIT hoặc TOP tùy hệ quản trị cơ sở dữ liệu. Sắp xếp thường đi cùng giới hạn để tìm nhanh các giá trị lớn nhất hoặc nhỏ nhất.

## Kết hợp bảng với JOIN

Dữ liệu thực tế thường nằm rải rác ở nhiều bảng, nên cần JOIN để ghép chúng qua khóa chung. INNER JOIN chỉ giữ các hàng có khớp ở cả hai bảng. LEFT JOIN giữ toàn bộ hàng của bảng bên trái, những hàng không khớp sẽ có giá trị NULL ở bảng bên phải. Khi ghép nhiều bảng, nên đặt bí danh cho bảng để câu lệnh gọn hơn và tránh nhầm cột trùng tên.

## Tổng hợp với GROUP BY

GROUP BY gom các hàng có cùng giá trị thành nhóm, rồi áp dụng hàm tổng hợp như COUNT, SUM, AVG, MIN, MAX cho từng nhóm. Điều kiện trên kết quả đã tổng hợp phải viết trong HAVING, vì WHERE chỉ lọc hàng trước khi gom nhóm. Hiểu rõ thứ tự thực thi gồm FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY giúp tránh nhiều lỗi thường gặp.