import os
import re

# --- CẤU HÌNH ---
INPUT_FILE = 'final_jsdoc_v10.txt'
SCRIPTS_DIR = './scripts'
FILE_EXTENSION = '.test.js'

def clean_jsdoc(content):
    """Loại bỏ dòng シナリオ番号 và các dòng trống thừa"""
    lines = content.split('\n')
    # Lọc bỏ dòng chứa 'シナリオ番号'
    cleaned_lines = [line for line in lines if 'シナリオ番号' not in line]
    # Nối lại và xử lý khoảng trắng thừa ở đầu/cuối khối
    return '\n'.join(cleaned_lines).strip()

def get_jsdoc_map(input_path):
    """Tách file txt thành map: {scenario_id: cleaned_jsdoc}"""
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    blocks = re.split(r'(?=\/\*\*)', content)
    jsdoc_map = {}
    
    for block in blocks:
        if 'シナリオ番号：' in block:
            id_match = re.search(r'シナリオ番号：\s*([A-Z0-9_]+)', block)
            if id_match:
                scenario_id = id_match.group(1)
                end_idx = block.find('*/') + 2
                raw_comment = block[:end_idx].strip()
                # Làm sạch nội dung (bỏ dòng ID)
                jsdoc_map[scenario_id] = clean_jsdoc(raw_comment)
                
    return jsdoc_map

def update_test_files(jsdoc_map, root_dir):
    """Tìm và thay thế comment cũ dựa trên ID function"""
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(FILE_EXTENSION):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                updated = False
                for scenario_id, new_comment in jsdoc_map.items():
                    # Regex này nhận diện:
                    # 1. Các loại comment cũ (//... hoặc /**...*/) ngay phía trên function
                    # 2. Định danh function bắt đầu bằng scenario_id
                    pattern = re.compile(
                        r'(?:\/\/[^\n]*\n|\/\*\*.*?\*\/\s*)?' + # Comment cũ (nếu có)
                        r'(export\s+function\s+' + re.escape(scenario_id) + r'_[A-Za-z0-9_]+\s*\()',
                        re.DOTALL
                    )

                    if pattern.search(content):
                        # Thay thế bằng comment mới (đã bỏ dòng ID) và giữ nguyên phần khai báo function
                        content = pattern.sub(f"{new_comment}\n\\1", content)
                        updated = True
                        print(f"  [✓] Updated: {scenario_id} in {file}")

                if updated:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)

if __name__ == "__main__":
    if not os.path.exists(INPUT_FILE):
        print(f"Lỗi: Không tìm thấy file {INPUT_FILE}")
    else:
        print("--- Đang xử lý dữ liệu JSDoc ---")
        data_map = get_jsdoc_map(INPUT_FILE)
        print(f"Đã sẵn sàng {len(data_map)} kịch bản (đã lọc dòng ID).\n")

        print("--- Đang cập nhật mã nguồn ---")
        update_test_files(data_map, SCRIPTS_DIR)
        print("\nHoàn tất!")
