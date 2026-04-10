cmake_minimum_required(VERSION 3.14)
project(flagforge-c-sdk VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# --- C++ SDK (core implementation, built as subdirectory) ---
set(CPP_SDK_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)
add_subdirectory(${CPP_SDK_DIR} ${CMAKE_CURRENT_BINARY_DIR}/cpp_sdk)

# --- C SDK wrapper library ---
# Compiled as C++ (wraps C++ API) but exposes pure C ABI
add_library(flagforge-c-sdk
    src/flagforge.cpp
)

target_include_directories(flagforge-c-sdk PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Link the C++ SDK for implementation
target_link_libraries(flagforge-c-sdk PUBLIC flagforge-sdk)

# --- C Example executable (compiled as pure C) ---
add_executable(flagforge-c-example
    ${CMAKE_CURRENT_SOURCE_DIR}/../../example/c/main.c
)

target_link_libraries(flagforge-c-example PRIVATE flagforge-c-sdk)
