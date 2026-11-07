# Nhập môn học máy cho người tự học

## Chương 1. Học máy là gì

Học máy là một nhánh của trí tuệ nhân tạo, trong đó máy tính tự rút ra quy luật từ dữ liệu thay vì được lập trình từng quy tắc cụ thể. Một chương trình lọc thư rác truyền thống cần lập trình viên viết sẵn danh sách từ khóa đáng ngờ. Với học máy, ta đưa cho mô hình hàng nghìn thư đã được gán nhãn là thư rác hoặc thư thường, và mô hình tự tìm ra dấu hiệu phân biệt.

Có ba nhóm bài toán chính. Học có giám sát dùng dữ liệu có nhãn để dự đoán nhãn cho dữ liệu mới, ví dụ dự đoán giá nhà hoặc phân loại email. Học không giám sát làm việc với dữ liệu không có nhãn, mục tiêu là tìm cấu trúc ẩn như các nhóm khách hàng giống nhau. Học tăng cường cho một tác tử thử và sai trong môi trường, nhận phần thưởng khi hành động tốt, như chương trình chơi cờ tự cải thiện qua hàng triệu ván.

Quy trình điển hình gồm năm bước: xác định bài toán, thu thập dữ liệu, làm sạch và chuẩn bị dữ liệu, huấn luyện mô hình, đánh giá và triển khai. Phần lớn thời gian của một dự án thực tế dành cho dữ liệu chứ không phải cho mô hình. Dữ liệu thiếu, nhiễu hoặc lệch sẽ làm mô hình học sai, dù thuật toán có tinh vi đến đâu.

## Chương 2. Dữ liệu và đặc trưng

Dữ liệu cho học máy thường được tổ chức thành bảng, mỗi hàng là một mẫu và mỗi cột là một đặc trưng. Đặc trưng có thể là số, như tuổi hoặc thu nhập, hoặc là hạng mục, như thành phố hoặc loại sản phẩm. Biến cần dự đoán gọi là biến mục tiêu.

Làm sạch dữ liệu bao gồm xử lý giá trị thiếu, loại bỏ bản ghi trùng lặp và phát hiện ngoại lệ. Với giá trị thiếu, ta có thể điền bằng trung bình, trung vị hoặc giá trị phổ biến nhất, hoặc bỏ hẳn bản ghi nếu số lượng nhỏ. Mỗi cách đều có cái giá riêng, vì điền trung bình làm giảm độ biến thiên thật của dữ liệu.

Kỹ thuật đặc trưng là việc tạo ra biến mới có ích từ biến cũ. Ví dụ, từ ngày mua hàng ta tách ra thứ trong tuần và tháng, vì hành vi mua sắm thường có tính chu kỳ. Biến hạng mục cần được mã hóa thành số, phổ biến nhất là mã hóa one-hot. Chuẩn hóa thang đo giúp các thuật toán dựa trên khoảng cách không bị chi phối bởi biến có giá trị lớn.

Dữ liệu cần được chia thành tập huấn luyện và tập kiểm tra, thường theo tỉ lệ tám mươi và hai mươi phần trăm. Mô hình chỉ được học trên tập huấn luyện. Tập kiểm tra đóng vai trò dữ liệu chưa từng thấy để đo khả năng tổng quát hóa. Rò rỉ dữ liệu xảy ra khi thông tin từ tập kiểm tra lọt vào quá trình huấn luyện, khiến kết quả đánh giá đẹp một cách giả tạo.

## Chương 3. Các mô hình cơ bản

Hồi quy tuyến tính dự đoán một giá trị liên tục bằng tổ hợp tuyến tính của các đặc trưng. Mô hình tìm hệ số sao cho tổng bình phương sai số giữa giá trị dự đoán và giá trị thật là nhỏ nhất. Ưu điểm là dễ diễn giải: mỗi hệ số cho biết biến mục tiêu thay đổi bao nhiêu khi đặc trưng tăng một đơn vị.

Hồi quy logistic dùng cho bài toán phân loại nhị phân. Nó đưa kết quả của tổ hợp tuyến tính qua hàm sigmoid để thu được xác suất nằm giữa không và một. Ngưỡng quyết định mặc định là 0,5, nhưng có thể điều chỉnh tùy chi phí của từng loại sai lầm.

Cây quyết định chia dữ liệu bằng chuỗi câu hỏi có hoặc không về các đặc trưng. Mỗi lần chia chọn đặc trưng và ngưỡng làm giảm độ hỗn tạp nhiều nhất, đo bằng chỉ số Gini hoặc entropy. Cây dễ hiểu nhưng dễ học thuộc dữ liệu huấn luyện. Rừng ngẫu nhiên khắc phục điều này bằng cách huấn luyện nhiều cây trên các mẫu con khác nhau rồi lấy biểu quyết, nhờ vậy giảm phương sai đáng kể.

Thuật toán k láng giềng gần nhất phân loại một điểm mới dựa trên nhãn của k điểm gần nhất trong tập huấn luyện. Thuật toán không có giai đoạn huấn luyện thực sự, nhưng dự đoán chậm khi dữ liệu lớn và rất nhạy với thang đo của các đặc trưng.

## Chương 4. Đánh giá mô hình

Độ chính xác là tỉ lệ dự đoán đúng, nhưng dễ gây hiểu lầm khi các lớp mất cân bằng. Nếu chỉ một phần trăm giao dịch là gian lận, một mô hình luôn trả lời không gian lận vẫn đạt độ chính xác chín mươi chín phần trăm mà hoàn toàn vô dụng.

Vì vậy ta dùng ma trận nhầm lẫn và các chỉ số phái sinh. Độ chuẩn xác cho biết trong số các mẫu mô hình báo là dương tính, bao nhiêu mẫu thật sự dương tính. Độ phủ cho biết trong số các mẫu thật sự dương tính, mô hình bắt được bao nhiêu. Chỉ số F1 là trung bình điều hòa của hai đại lượng này, phù hợp khi cần cân bằng giữa chúng.

Quá khớp xảy ra khi mô hình đạt kết quả rất tốt trên tập huấn luyện nhưng kém trên tập kiểm tra, vì nó đã học cả nhiễu. Thiếu khớp là tình huống ngược lại, mô hình quá đơn giản nên không nắm được quy luật. Kiểm định chéo chia dữ liệu thành nhiều phần và lần lượt dùng mỗi phần làm tập kiểm tra, cho ước lượng ổn định hơn một lần chia duy nhất.

Điều chuẩn là kỹ thuật phạt độ phức tạp của mô hình để chống quá khớp. Điều chuẩn L1 có xu hướng đưa một số hệ số về đúng bằng không, nên đồng thời giúp chọn đặc trưng. Điều chuẩn L2 thu nhỏ đều các hệ số nhưng hiếm khi triệt tiêu hoàn toàn.

## Chương 5. Mạng nơ-ron và học sâu

Mạng nơ-ron gồm các lớp nút, mỗi nút nhận đầu vào, nhân với trọng số, cộng độ lệch rồi đưa qua hàm kích hoạt. Hàm kích hoạt phi tuyến như ReLU cho phép mạng biểu diễn các quan hệ phức tạp mà mô hình tuyến tính không làm được. Học sâu là việc dùng mạng có nhiều lớp ẩn.

Quá trình huấn luyện lặp lại hai bước. Lan truyền thuận tính đầu ra của mạng và độ lỗi so với nhãn thật. Lan truyền ngược tính đạo hàm của độ lỗi theo từng trọng số, sau đó thuật toán hạ gradient cập nhật trọng số theo hướng làm giảm lỗi. Tốc độ học quyết định bước cập nhật lớn hay nhỏ: quá lớn thì dao động và không hội tụ, quá nhỏ thì học rất chậm.

Mạng tích chập phù hợp với dữ liệu ảnh nhờ các bộ lọc trượt trên ảnh để phát hiện cạnh, góc rồi đến các hình dạng phức tạp hơn. Mạng hồi quy xử lý dữ liệu chuỗi như văn bản bằng cách giữ trạng thái ẩn qua từng bước thời gian. Kiến trúc transformer dùng cơ chế chú ý để mỗi từ có thể tham chiếu trực tiếp đến mọi từ khác trong câu, và là nền tảng của các mô hình ngôn ngữ hiện đại.

Học sâu đòi hỏi nhiều dữ liệu và sức tính toán hơn các mô hình cổ điển. Với dữ liệu dạng bảng quy mô vừa, các mô hình cây thường cho kết quả ngang hoặc tốt hơn mà chi phí thấp hơn nhiều. Chọn công cụ phù hợp với bài toán quan trọng hơn chạy theo kỹ thuật mới nhất.
