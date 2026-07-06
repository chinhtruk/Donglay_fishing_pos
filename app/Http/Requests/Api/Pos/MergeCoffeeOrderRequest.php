<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;

class MergeCoffeeOrderRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
            'target_table_id' => ['required', 'integer', 'exists:coffee_tables,id'],
        ];
    }
}
