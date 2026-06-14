import sys
with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """      { key: "hexavalente", label: "HEXAVALENTE", color: "9ACD32", lightColor: "CDE69A", fontColor: "FF000000" },
      { key: "dpt", label: "DPT", color: "ED7D31", lightColor: "F4B084", fontColor: "FF000000" },
      { key: "rotavirus", label: "ROTAVIRUS", color: "7030A0", lightColor: "B4A2C7", fontColor: "FFFFFFFF" },
      { key: "neumococica_13", label: "NEUMOCÓCICA 13V", color: "5B9BD5", lightColor: "9CC2E5", fontColor: "FF000000" },
      { key: "neumococica_20", label: "NEUMOCÓCICA 20V", color: "1F4E78", lightColor: "9CC2E5", fontColor: "FFFFFFFF" },
      { key: "srp", label: "SRP", color: "B23A48", lightColor: "F3B7CA", fontColor: "FFFFFFFF" },
      { key: "sr", label: "SR", color: "7B5EA7", lightColor: "C1B3D5", fontColor: "FFFFFFFF" },
      { key: "td", label: "TD", color: "9E9E9E", lightColor: "C0C0C0", fontColor: "FF000000" }"""

new_block = """      { key: "hexavalente", label: "HEXAVALENTE", color: "9ACD32", lightColor: "CDE69A", fontColor: "FF000000" },
      { key: "dpt", label: "DPT", color: "E9C46A", lightColor: "F3E0AF", fontColor: "FF000000" },
      { key: "rotavirus", label: "ROTAVIRUS", color: "264653", lightColor: "93BCCD", fontColor: "FFFFFFFF" },
      { key: "neumococica_13", label: "NEUMOCÓCICA 13", color: "3D405B", lightColor: "ACAFC8", fontColor: "FFFFFFFF" },
      { key: "neumococica_20", label: "NEUMOCÓCICA 20", color: "3D405B", lightColor: "ACAFC8", fontColor: "FFFFFFFF" },
      { key: "srp", label: "SRP", color: "B23A48", lightColor: "F3B7CA", fontColor: "FFFFFFFF" },
      { key: "sr", label: "SR", color: "7B5EA7", lightColor: "C1B3D5", fontColor: "FFFFFFFF" },
      { key: "vph", label: "VPH", color: "2A9D8F", lightColor: "A4E6DE", fontColor: "FF000000" },
      { key: "varicela", label: "VARICELA", color: "8ED1C2", lightColor: "BEE4DC", fontColor: "FF000000" },
      { key: "hepatitis_a", label: "HEPATITIS A", color: "BDBDBD", lightColor: "DBDBDB", fontColor: "FF000000" },
      { key: "td", label: "TD", color: "9E9E9E", lightColor: "C0C0C0", fontColor: "FF000000" }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('main.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed insumos array successfully.")
else:
    print("Could not find the block to replace!")
