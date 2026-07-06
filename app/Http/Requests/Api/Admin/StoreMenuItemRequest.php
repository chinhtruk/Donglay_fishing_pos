<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;

class StoreMenuItemRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'category_id' => ['nullable', 'integer', 'exists:menu_categories,id', 'required_without:category'],
            'category' => ['nullable', 'string', 'max:80', 'required_without:category_id'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'display_price' => ['nullable', 'string', 'max:50'],
            'is_available' => ['required', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:30720'],
            'remove_image' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.image' => 'Tệp bạn chọn chưa phải là ảnh phù hợp. Bạn thử chọn ảnh JPG, PNG hoặc WebP nhé.',
            'image.mimes' => 'Ảnh món hỗ trợ định dạng JPG, PNG hoặc WebP nhé.',
            'image.max' => 'Ảnh món hơi lớn một chút. Bạn vui lòng chọn ảnh không quá 30 MB nhé.',
        ];
    }
}
