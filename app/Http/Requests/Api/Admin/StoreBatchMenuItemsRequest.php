<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;

class StoreBatchMenuItemsRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'category_id' => ['nullable', 'integer', 'exists:menu_categories,id', 'required_without:category_name'],
            'category_name' => ['nullable', 'string', 'max:80', 'required_without:category_id'],
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.name' => ['required', 'string', 'max:120'],
            'items.*.description' => ['nullable', 'string', 'max:1000'],
            'items.*.price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'items.*.display_price' => ['nullable', 'string', 'max:50'],
            'items.*.is_available' => ['required', 'boolean'],
            'items.*.image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:30720'],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.required_without' => 'Bạn hãy chọn một nhóm món hoặc tạo nhóm mới nhé.',
            'category_name.required_without' => 'Bạn hãy nhập tên cho nhóm món mới nhé.',
            'items.required' => 'Bạn hãy thêm ít nhất một món nhé.',
            'items.max' => 'Mỗi lần bạn có thể thêm tối đa 20 món để việc kiểm tra dễ dàng hơn nhé.',
            'items.*.name.required' => 'Bạn hãy nhập tên món nhé.',
            'items.*.price.required' => 'Bạn hãy nhập giá bán cho món nhé.',
            'items.*.image.image' => 'Một tệp đã chọn chưa phải là ảnh phù hợp. Bạn thử chọn JPG, PNG hoặc WebP nhé.',
            'items.*.image.mimes' => 'Ảnh món hỗ trợ định dạng JPG, PNG hoặc WebP nhé.',
            'items.*.image.max' => 'Mỗi ảnh món không được lớn hơn 30 MB nhé.',
        ];
    }
}
