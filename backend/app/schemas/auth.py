from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    user_id: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")
    password: str = Field(min_length=1, max_length=128)

    def normalized_user_id(self) -> str:
        return self.user_id.strip().lower()


class AuthUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
