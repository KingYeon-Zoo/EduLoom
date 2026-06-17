"""Doubao (Volcengine Ark) integration exceptions.

These wrap raw SDK / HTTP errors into the project's exception hierarchy so
callers can handle them uniformly. All inherit from OpenNotebookError.
"""

from open_notebook.exceptions import OpenNotebookError


class DoubaoError(OpenNotebookError):
    """Base class for all Doubao integration errors."""

    pass


class DoubaoConfigError(DoubaoError):
    """Raised when Doubao credentials / model IDs are missing or invalid."""

    pass


class DoubaoTaskFailed(DoubaoError):
    """Raised when an async generation task ends in a failed/cancelled state."""

    def __init__(self, message: str, task_id: str | None = None, code: str | None = None):
        super().__init__(message)
        self.task_id = task_id
        self.code = code


class DoubaoTimeout(DoubaoError):
    """Raised when polling an async task exceeds the allowed wait time."""

    def __init__(self, message: str, task_id: str | None = None):
        super().__init__(message)
        self.task_id = task_id
