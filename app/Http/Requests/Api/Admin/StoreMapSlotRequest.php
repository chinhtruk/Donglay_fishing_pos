<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use Illuminate\Validation\Rule;

class StoreMapSlotRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['coffee', 'fishing'])],
            'label' => ['required', 'string', 'max:50'],
            'is_enabled' => ['boolean'],
        ];
    }
}
