import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Job:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    status: str = 'running'   # running | done | error
    progress: int = 0
    total: int = 0
    message: str = ''
    result: dict = field(default_factory=dict)
    error: str = ''


_jobs: dict[str, Job] = {}


def create(total: int = 0) -> Job:
    job = Job(total=total)
    _jobs[job.id] = job
    return job


def get(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def update(job_id: str, **kwargs: Any) -> None:
    job = _jobs.get(job_id)
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)


def to_dict(job: Job) -> dict:
    return {
        'id':       job.id,
        'status':   job.status,
        'progress': job.progress,
        'total':    job.total,
        'message':  job.message,
        'result':   job.result,
        'error':    job.error,
    }
