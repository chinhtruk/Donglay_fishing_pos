<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use App\Models\User;
use Illuminate\Validation\Rule;

class StoreUserRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'username' => mb_strtolower(trim((string) $this->input('username'))),
            'email' => $this->filled('email') ? mb_strtolower(trim((string) $this->input('email'))) : null,
        ]);
    }

    public function rules(): array
    {
        $user = $this->route('user');
        $user = $user instanceof User ? $user : null;

        return [
            'name' => ['required', 'string', 'max:120'],
            'username' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9._-]+$/', Rule::unique('users')->ignore($user?->id)],
            'email' => ['required', 'email', 'max:190', Rule::unique('users')->ignore($user?->id)],
            'email_verified' => ['sometimes', 'boolean'],
            'password' => [$user ? 'nullable' : 'sometimes', 'string', 'min:8', 'max:72'],
            'role' => ['required', Rule::in(['admin', 'employee'])],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Email này đã được dùng cho tài khoản khác.',
            'username.unique' => 'Username đã tồn tại.',
        ];
    }
}
