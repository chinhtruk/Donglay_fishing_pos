<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use Illuminate\Validation\Rule;

class UpdateMapRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['coffee', 'fishing'])],
            'slots' => ['required', 'array', 'min:1'],
            'slots.*.id' => ['required', 'integer'],
            'slots.*.label' => ['required', 'string', 'max:50'],
            'slots.*.position_x' => ['required', 'numeric', 'between:0,100'],
            'slots.*.position_y' => ['required', 'numeric', 'between:0,100'],
            'slots.*.is_enabled' => ['required', 'boolean'],
        ];
    }
}
