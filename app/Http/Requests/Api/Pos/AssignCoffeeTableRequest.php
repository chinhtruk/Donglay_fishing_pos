<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;

class AssignCoffeeTableRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer'],
            'coffee_table_id' => ['nullable', 'integer', 'exists:coffee_tables,id'],
        ];
    }
}
