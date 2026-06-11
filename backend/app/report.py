from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt


def create_materiality_report(data: dict) -> BytesIO:
    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)

    title = document.add_heading("高雄大學雙重重大性評估報告", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle = document.add_paragraph(f"{data['campaign'].year} 年度分析摘要")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

    document.add_heading("2.3 利害關係人溝通", level=1)
    document.add_paragraph(
        f"本次評估共回收 {data['response_count']} 份有效問卷，"
        f"涵蓋 {data['stakeholder_count']} 類利害關係人，"
        f"目前填答完成率為 {data['completion_rate']}%。"
    )
    if data["stakeholders"]:
        table = document.add_table(rows=1, cols=2)
        table.style = "Light Shading Accent 1"
        table.rows[0].cells[0].text = "利害關係人"
        table.rows[0].cells[1].text = "有效問卷數"
        for item in data["stakeholders"]:
            cells = table.add_row().cells
            cells[0].text = item["name"]
            cells[1].text = str(item["count"])

    document.add_heading("2.4 重大主題分析", level=1)
    document.add_paragraph(data["analysis_zh"])
    table = document.add_table(rows=1, cols=6)
    table.style = "Light Shading Accent 1"
    headers = ["議題", "類別", "組織影響", "衝擊重大性", "財務重大性", "判定"]
    for index, header in enumerate(headers):
        table.rows[0].cells[index].text = header
    for topic in sorted(
        data["topics"], key=lambda item: (item["impact"] + item["financial"]), reverse=True
    ):
        cells = table.add_row().cells
        values = [
            topic["name"],
            topic["category"],
            f"{topic['organization']:.2f}",
            f"{topic['impact']:.2f}",
            f"{topic['financial']:.2f}",
            topic["quadrant"],
        ]
        for index, value in enumerate(values):
            cells[index].text = value

    document.add_heading("2.5 雙重重大性評估", level=1)
    document.add_paragraph(
        "本評估同步考量組織對環境與社會造成的實際或潛在衝擊，以及永續議題對學校財務、"
        "營運與策略韌性的影響。衝擊重大性與財務重大性門檻均設定為 "
        f"{data['campaign'].impact_threshold:.1f} 分。"
    )
    document.add_paragraph(
        "四象限定義：高衝擊高財務為重大主題；高衝擊低財務為揭露主題；"
        "低衝擊高財務為風險主題；低衝擊低財務為觀察主題。"
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

