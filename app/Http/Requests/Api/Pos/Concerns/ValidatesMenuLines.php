<?php

namespace App\Http\Requests\Api\Pos\Concerns;

trait ValidatesMenuLines
{
    /**
     * @return array<string, array<int, string>>
     */
    protected function menuLineRules(string $itemsRule): array
    {
        return [
            'items' => explode('|', $itemsRule),
            'items.*.menu_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.unit_price' => ['sometimes', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
