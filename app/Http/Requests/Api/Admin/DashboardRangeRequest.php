<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use Illuminate\Validation\Validator;

class DashboardRangeRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $from = $this->date('from')?->startOfDay() ?? now()->subDays(29)->startOfDay();
            $to = $this->date('to')?->endOfDay() ?? now()->endOfDay();

            if ($from->diffInDays($to) > 366) {
                $validator->errors()->add('to', 'Bạn hãy chọn khoảng thời gian tối đa 12 tháng để báo cáo dễ theo dõi nhé.');
            }
        });
    }
}
