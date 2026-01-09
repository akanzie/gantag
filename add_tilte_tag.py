import os
import re

# --- CẤU HÌNH ---
SCRIPTS_DIR = './04_void'
FILE_EXTENSION = '.test.js'

def add_tag_after_description(content):
    """
    Sử dụng Regex để tìm @description và chèn ### タグ nếu chưa có.
    """
    # 1. Pattern tìm khối JSDoc
    jsdoc_pattern = re.compile(r'(/\*\*[\s\S]*?\*/)', re.MULTILINE)

    def replace_jsdoc(match):
        block = match.group(1)
        
        # 2. Kiểm tra xem trong khối này đã có "### タグ" chưa
        if '### タグ' in block:
            return block

        # 3. Tìm vị trí của @description
        # Pattern này tìm '@description' + nội dung đi kèm cho đến hết dòng
        # Sau đó chèn thêm dòng ' * ### タグ' vào ngay dưới.
        new_block = re.sub(
            r'(\*\s*@description.*)', 
            r'\1\n * ### タグ', 
            block
        )
        
        return new_block

    new_content, count = jsdoc_pattern.subn(replace_jsdoc, content)
    return new_content, count

def process_test_files(root_dir):
    total_updated = 0
    total_files = 0

    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(FILE_EXTENSION):
                file_path = os.path.join(root, file)
                total_files += 1

                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                new_content, replacements = add_tag_after_description(content)

                if new_content != content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"  [✓] Đã cập nhật file: {file}")
                    total_updated += 1 # Đếm số file thay đổi

    print(f"\nĐã duyệt {total_files} file {FILE_EXTENSION}")
    print(f"Đã cập nhật {total_updated} file.")

if __name__ == "__main__":
    if not os.path.exists(SCRIPTS_DIR):
        print(f"Lỗi: Không tìm thấy thư mục {SCRIPTS_DIR}")
    else:
        print(f"--- Bắt đầu quét thư mục: {SCRIPTS_DIR} ---")
        process_test_files(SCRIPTS_DIR)
        print("\nHoàn tất!")
