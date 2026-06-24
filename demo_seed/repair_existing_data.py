import asyncio
from open_notebook.domain.artifact import StudioArtifact
from commands.studio_commands import repair_mermaid

async def run_repair():
    print("开始修复数据库中已有的 Mermaid 脑图语法错误...")
    artifacts = await StudioArtifact.get_all()
    count = 0
    for art in artifacts:
        if art.resource_type == "mindmap" and art.content:
            repaired = repair_mermaid(art.content)
            if repaired != art.content:
                print(f"修复 Artifact: {art.name} ({art.id})")
                art.content = repaired
                await art.save()
                count += 1
    print(f"修复完成！共修复了 {count} 个脑图。")

if __name__ == "__main__":
    asyncio.run(run_repair())
