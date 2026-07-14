<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Đồng lầy Fishing</title>
    <script>try{if(localStorage.getItem('donglay.sidebar')==='collapsed')document.documentElement.classList.add('sidebar-collapsed')}catch(e){}</script>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body data-view="app" data-role="{{ auth()->user()->role }}" data-user="{{ auth()->user()->name }}">
<div class="app-shell">
    @include('app.partials.sidebar')
    <div class="workspace">
        @include('app.partials.topbar')
        <main id="page-content" class="page-content">@include('app.partials.loading-state')</main>
    </div>
</div>
@include('app.partials.roots')
</body>
</html>
