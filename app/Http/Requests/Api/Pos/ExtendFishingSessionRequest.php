<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;
use Illuminate\Validation\Rule;

class ExtendFishingSessionRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
            'mode' => ['sometimes', Rule::in(['session', 'hour'])],
            'blocks' => ['sometimes', 'integer', 'min:1', 'max:4'],
            'hours' => ['sometimes', 'integer', 'min:1', 'max:3'],
        ];
    }
}
