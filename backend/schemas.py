from pydantic import BaseModel
from typing import Optional

class StatsResponse(BaseModel):
    total_xp: int
    streak_days: int
    last_active: Optional[str]
    virtual_balance: float
    total_trades: int
    win_rate: float
    avg_win: float
    avg_loss: float
    total_pnl: float
    max_drawdown: float

class CloseResponse(BaseModel):
    trade_id: int
    pnl: float
    status: str

class ReportResponse(BaseModel):
    report: str
    thesis_score: Optional[int]
    process_verdict: Optional[str]
    cached: bool

class AnalysisResponse(BaseModel):
    final_bias_score: float
    market_bias: str
    metrics: dict
    market_data: list
    analysis_time: str
    playbook_title: Optional[str]
    playbook_reasoning: Optional[str]
    playbook_action: Optional[str]
    session: dict
    auto_fetch: bool
