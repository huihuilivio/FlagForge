cmake_minimum_required(VERSION 3.14)
project(flagforge-sdk VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(flagforge-sdk
    src/feature_manager.cpp
)

target_include_directories(flagforge-sdk PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)
