from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt


def add_table(document: Document, headers: list[str], rows: list[list[str]]) -> None:
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Light Shading Accent 1"
    for index, header in enumerate(headers):
        table.rows[0].cells[index].text = header
    for row in rows:
        cells = table.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = value


def create_materiality_report(data: dict) -> BytesIO:
    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)

    title = document.add_heading("大學永續報告書雙重重大性評估報告", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle = document.add_paragraph(f"{data['campaign'].year} 年度")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

    document.add_heading("2.3 利害關係人溝通", level=1)
    document.add_paragraph(
        f"本次問卷共回收 {data['response_count']} 份有效回覆，涵蓋 {data['stakeholder_count']} 類利害關係人，"
        f"整體回收率為 {data['completion_rate']}%。"
    )
    if data["stakeholders"]:
        add_table(
            document,
            ["利害關係人類別", "樣本數", "權重"],
            [[item["name"], str(item["count"]), f"{item['weight']:.2f}"] for item in data["stakeholders"]],
        )

    document.add_heading("2.4 重大主題鑑別流程", level=1)
    document.add_paragraph(
        "本平台依雙重重大性方法彙整衝擊重大性與財務重大性評分，並保留未加權平均、加權平均、"
        "利害關係人分群結果、門檻設定與樣本數，作為 GRI 3-1 揭露依據。"
    )

    document.add_heading("2.5 雙重重大性評估結果", level=1)
    document.add_paragraph(data["analysis_zh"])
    add_table(
        document,
        ["議題", "類別", "衝擊", "財務", "加權衝擊", "加權財務", "判定"],
        [
            [
                f"{topic['code']} {topic['name']}",
                topic["category"],
                f"{topic['impact']:.2f}",
                f"{topic['financial']:.2f}",
                f"{topic['weighted_impact']:.2f}",
                f"{topic['weighted_financial']:.2f}",
                topic["quadrant"],
            ]
            for topic in sorted(data["topics"], key=lambda item: item["impact"] + item["financial"], reverse=True)
        ],
    )

    document.add_heading("2.6 重大主題管理方針", level=1)
    document.add_paragraph(
        "針對重大主題，建議責任單位於報告書中說明政策承諾、管理作為、KPI、年度績效與改善計畫。"
    )

    document.add_heading("GRI 3-1 Process to determine material topics", level=1)
    document.add_paragraph("The process uses stakeholder survey results, weighted stakeholder inputs and double materiality thresholds.")
    document.add_heading("GRI 3-2 List of material topics", level=1)
    document.add_paragraph("Material topics are listed in the assessment result table above.")
    document.add_heading("GRI 3-3 Management of material topics", level=1)
    document.add_paragraph("Management approaches should be reviewed by each responsible unit before publication.")

    document.add_heading("附錄：問卷方法", level=1)
    document.add_paragraph(
        f"評分尺度為 1=極低、2=低、3=中、4=高、5=極高。"
        f"衝擊重大性門檻為 {data['campaign'].impact_threshold:.1f}，"
        f"財務重大性門檻為 {data['campaign'].financial_threshold:.1f}。"
    )

    document.add_heading("English Summary", level=1)
    document.add_paragraph(data["analysis_en"])

    styles = document.styles
    styles["Normal"].font.name = "Microsoft JhengHei"
    styles["Normal"].font.size = Pt(10.5)

    output = BytesIO()
    document.save(output)
    output.seek(0)
    return output
