"""LearningCoordinator + the agent roster (Projects C/D/E).

The coordinator is a thin sequencer over named role-agents. It owns no state of
its own; each method assembles inputs (notebook content, learner-profile
summary, existing resources) and drives the relevant graph, returning plain
data the service/command layer persists.

``AGENT_ROSTER`` is the single source of truth for "who collaborates" — surfaced
verbatim to the frontend (协作智能体 tab) and the architecture docs.
"""

from typing import Dict, List

from loguru import logger

from edu_loom.graphs.assessment import graph as assessment_graph
from edu_loom.graphs.path_planning import graph as path_graph
from edu_loom.utils.learning_context import (
    build_notebook_content,
    summarize_learner_profile,
)

# Single source of truth for the multi-agent roster (shown in UI + docs).
# Each entry: stable key, Chinese role name, project tag, responsibility.
AGENT_ROSTER: List[Dict[str, str]] = [
    {
        "key": "path_planner",
        "name": "路径规划师 PathPlanner",
        "project": "D",
        "responsibility": "结合课程内容与学习画像，规划有序、循序渐进的个性化学习路径。",
    },
    {
        "key": "resource_pusher",
        "name": "资源推送官 ResourcePusher",
        "project": "D",
        "responsibility": "把已生成的多模态资源精准匹配到路径各步骤，并标注资源缺口。",
    },
    {
        "key": "assessment_analyst",
        "name": "评估分析师 AssessmentAnalyst",
        "project": "E",
        "responsibility": "基于画像、练习产物与进度，多维评估学习效果并给出调整建议。",
    },
    {
        "key": "tutor",
        "name": "智能辅导员 TutorAgent",
        "project": "E",
        "responsibility": "即时答疑：优先文字解答并推荐已有资源，必要时建议生成新资源（需用户确认）。",
    },
    {
        "key": "recommender",
        "name": "资源顾问 RecommenderAgent",
        "project": "C",
        "responsibility": "根据学习画像，为资源生成推荐最合适的预设与自定义指令。",
    },
    {
        "key": "report_writer",
        "name": "讲解撰稿人 ReportWriter",
        "project": "C",
        "responsibility": "生成专业课程讲解 / 摘要文档。",
    },
    {
        "key": "quiz_master",
        "name": "命题官 QuizMaster",
        "project": "C",
        "responsibility": "生成不同类型的练习题库（含答案与解析）。",
    },
    {
        "key": "mindmap_architect",
        "name": "导图架构师 MindMapArchitect",
        "project": "C",
        "responsibility": "生成层级化的知识点思维导图。",
    },
    {
        "key": "slide_composer",
        "name": "课件设计师 SlideComposer",
        "project": "C",
        "responsibility": "生成多页要点幻灯并拼成学习 PPT。",
    },
    {
        "key": "video_director",
        "name": "视频导演 VideoDirector",
        "project": "C",
        "responsibility": "生成多模态教学视频。",
    },
]


class LearningCoordinator:
    """Thin orchestrator sequencing the learning role-agents."""

    @staticmethod
    def roster() -> List[Dict[str, str]]:
        """Return the agent roster for UI / docs."""
        return AGENT_ROSTER

    @staticmethod
    async def plan_path(notebook_id: str) -> dict:
        """Drive PathPlanner -> ResourcePusher for a notebook.

        Returns ``{"summary", "steps", "profile_snapshot"}``. Raises ValueError
        when the notebook has no usable content (permanent failure).
        """
        notebook_content = await build_notebook_content(notebook_id)
        if not notebook_content or not notebook_content.strip():
            raise ValueError(
                "Notebook has no usable source content to plan a path from"
            )
        profile_summary = await summarize_learner_profile()

        result = await path_graph.ainvoke(
            {
                "notebook_id": notebook_id,
                "notebook_content": notebook_content,
                "profile_summary": profile_summary,
            }
        )
        logger.info(
            f"LearningCoordinator.plan_path produced {len(result.get('steps', []))} steps"
        )
        return {
            "summary": result.get("summary", ""),
            "steps": result.get("steps", []),
            "profile_snapshot": {"summary": profile_summary},
        }

    @staticmethod
    async def assess(notebook_id: str, path_progress: str, quiz_content: str) -> dict:
        """Drive AssessmentAnalyst for a notebook.

        ``path_progress`` and ``quiz_content`` are pre-rendered by the caller
        (service/command) so this stays free of DB-query specifics.
        """
        profile_summary = await summarize_learner_profile()
        result = await assessment_graph.ainvoke(
            {
                "profile_summary": profile_summary,
                "path_progress": path_progress,
                "quiz_content": quiz_content,
            }
        )
        return {
            "dimensions": result.get("dimensions", []),
            "suggestions": result.get("suggestions", []),
            "overall_comment": result.get("overall_comment", ""),
            "profile_snapshot": {"summary": profile_summary},
        }
