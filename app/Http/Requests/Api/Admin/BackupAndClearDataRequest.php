<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use Illuminate\Validation\Rule;

class BackupAndClearDataRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'confirmation' => ['required', Rule::in(['BACKUP_AND_CLEAR'])],
            'password' => ['required', 'string'],
        ];
    }
}
