<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;
use App\Http\Requests\Api\Pos\Concerns\ValidatesMenuLines;

class UpdateFishingOrderRequest extends ApiRequest
{
    use ValidatesMenuLines;

    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
            ...$this->menuLineRules('present|array'),
        ];
    }
}
