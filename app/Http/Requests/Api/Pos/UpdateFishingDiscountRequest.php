<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;
use Illuminate\Validation\Rule;

class UpdateFishingDiscountRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
            'discount_amount' => [
                'required',
                'integer',
                Rule::in(config('fishing.discount_options', [0, 50000, 100000, 150000, 200000])),
            ],
        ];
    }
}
