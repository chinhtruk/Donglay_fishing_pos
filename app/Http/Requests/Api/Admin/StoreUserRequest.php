<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use App\Models\User;
use Illuminate\Validation\Rule;

class StoreUserRequest extends ApiRequest
{
    public function rules(): array
    {
        $user = $this->route('user');
        $user = $user instanceof User ? $user : null;

        return [
            'name' => ['required', 'string', 'max:120'],
            'username' => ['nullable', 'string', 'max:80', Rule::unique('users')->ignore($user?->id), 'required_if:role,admin'],
            'email' => ['nullable', 'email', 'max:190', Rule::unique('users')->ignore($user?->id), 'required_if:role,employee'],
            'email_verified' => ['sometimes', 'boolean'],
            'password' => [$user ? 'nullable' : 'sometimes', 'string', 'min:8'],
            'role' => ['required', Rule::in(['admin', 'employee'])],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
