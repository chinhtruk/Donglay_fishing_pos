<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;

class MergeFishingOrderRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
            'target_spot_id' => ['required', 'integer', 'exists:fishing_spots,id'],
        ];
    }
}
