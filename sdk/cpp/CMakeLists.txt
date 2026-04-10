cmake_minimum_required(VERSION 3.14)
project(flagforge-sdk VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- SDK library ---
add_library(flagforge-sdk
    src/feature_manager.cpp
)

target_include_directories(flagforge-sdk PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# httplib requires threads
find_package(Threads REQUIRED)
target_link_libraries(flagforge-sdk PUBLIC Threads::Threads)

# Windows: need ws2_32 for sockets
if(WIN32)
    target_link_libraries(flagforge-sdk PUBLIC ws2_32)
endif()

# --- Example executable ---
add_executable(flagforge-example
    ${CMAKE_CURRENT_SOURCE_DIR}/../../example/cpp/main.cpp
)

target_link_libraries(flagforge-example PRIVATE flagforge-sdk)
