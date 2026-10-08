from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=150)
    password: SecretStr = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: UserRole
    district: str | None
    block: str | None
    is_active: bool
