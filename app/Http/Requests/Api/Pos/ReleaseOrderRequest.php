<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;

class ReleaseOrderRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
        ];
    }
}
