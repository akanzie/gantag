import pandas as pd
import re

def format_line_with_stars_and_escape(line, is_expected_result=False):
    stripped = line.strip()
    if not stripped:
        return ""

    # 1. Bọc endpoint (linh hoạt: có dấu / và không chứa khoảng trắng)
    line = re.sub(r'([a-zA-Z0-9_.-]*/[a-zA-Z0-9/_.-]+)', r'`\1`', line)

    # 4. Xóa space sau dấu . của bullet số (1.  ABC -> 1. ABC)
    line = re.sub(r'^(\d+\.)\s+', r'\1', line)

    # 2. Tiêu đề con cho cột Z
    if is_expected_result and re.search(r'\d+\..*`.*`|/.*', line):
        return f"* #### {line.strip()}"

    # Logic thụt lề
    stripped_after_sub = line.strip()
    if stripped_after_sub.startswith('+'): return f"* * \\{stripped_after_sub}"
    if stripped_after_sub.startswith('-'): return f"* \\{stripped_after_sub}"
    if stripped_after_sub.startswith('.'): return f"* * * \\{stripped_after_sub}"
    if stripped_after_sub.startswith('・') or stripped_after_sub.startswith('→'):
        return f"* * {stripped_after_sub}"
    if line.startswith(' ') or line.startswith('\t'):
        return f"* * {stripped_after_sub}"

    return f"* {stripped_after_sub}"

def format_scenario_to_table(text):
    """Xử lý cột N: Tách ステップ | 手順 | エンドポイント"""
    if not text or pd.isna(text) or str(text).strip() == "": 
        return "| - | 特になし | - |"
    
    header = "| ステップ | 手順 | エンドポイント |\n * | :-: | :--- | :--- |"
    rows = []
    lines = str(text).split('\n')
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        # Bước 1: Tìm xem có endpoint (`/abc`) trong dòng không
        endpoint_match = re.search(r'([a-zA-Z0-9_.-]*/[a-zA-Z0-9/_.-]+)', line)
        endpoint = "-"
        content_clean = line
        
        if endpoint_match:
            endpoint = f"`{endpoint_match.group(1)}`"
            # Xóa endpoint khỏi nội dung chính để tránh lặp
            content_clean = line.replace(endpoint_match.group(1), "").strip()

        # Bước 2: Tách số thứ tự (Step) - Chấp nhận cả số 0
        step_match = re.match(r'^(\d+)\.?\s*(.*)', content_clean)
        
        if step_match:
            step_num = step_match.group(1)
            description = step_match.group(2).strip()
            # Xóa dấu chấm thừa ở cuối description nếu có
            description = re.sub(r'^[.\s]+', '', description)
            rows.append(f"| {step_num} | {description} | {endpoint} |")
        else:
            rows.append(f"| - | {content_clean} | {endpoint} |")
            
    return header + "\n * " + "\n * ".join(rows)

def format_general_content(text, is_precondition=False, is_expected_result=False):
    stripped_text = str(text).strip() if pd.notna(text) else ""
    if is_precondition and (not stripped_text or stripped_text == "" or stripped_text == "'特になし"):
        return "* 特になし"
    if not stripped_text: return ""
    
    lines = str(text).split('\n')
    formatted = [format_line_with_stars_and_escape(l, is_expected_result) for l in lines if l.strip()]
    return "\n * ".join(formatted)

def export_jsdoc_final_v12(excel_path, output_file='final_jsdoc_v12.txt'):
    try:
        target_cols = [2, 11, 12, 13, 22, 23, 25]
        df = pd.read_excel(excel_path, usecols=target_cols, header=None)
        df.columns = ['C', 'L', 'M', 'N', 'W', 'X', 'Z']

        with open(output_file, 'w', encoding='utf-8') as f:
            for index, row in df.iterrows():
                if index == 0: continue 
                jsdoc = (
                    f"/**\n"
                    f" * シナリオ番号：{str(row['C']).strip()}\n"
                    f" * @function {row['L']}\n"
                    f" * @memberof 返品\n"
                    f" * @description\n"
                    f" * ### ステップ\n"
                    f" * ### テスト観点\n"
                    f" * {format_general_content(row['M'])}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### テスト方法/シナリオ\n"
                    f" * {format_scenario_to_table(row['N'])}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### 前提条件\n"
                    f" * {format_general_content(row['W'], is_precondition=True)}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### テストデータ\n"
                    f" * {format_general_content(row['X'])}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### 期待結果\n"
                    f" * {format_general_content(row['Z'], is_expected_result=True)}\n"
                    f" */\n\n"
                )
                f.write(jsdoc)
        print(f"Đã xử lý xong các lỗi hiển thị bảng! File: {output_file}")
    except Exception as e:
        print(f"Lỗi: {e}")

export_jsdoc_final_v12('Scenario.xlsx')
