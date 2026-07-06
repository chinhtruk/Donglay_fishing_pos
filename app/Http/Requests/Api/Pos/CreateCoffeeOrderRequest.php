<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;
use App\Http\Requests\Api\Pos\Concerns\ValidatesMenuLines;

class CreateCoffeeOrderRequest extends ApiRequest
{
    use ValidatesMenuLines;

    public function rules(): array
    {
        return $this->menuLineRules('required|array|min:1');
    }
}
