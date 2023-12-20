package main

import (
	"fmt"
)

type MyCustomType struct {
	data []byte
}

func (m MyCustomType) WriteToSelf(input []byte) (int, error) {
	m.data = append(m.data, input...)
	return len(input), nil
}

func main() {
	t := MyCustomType{data: []byte("Hello")}
	fmt.Println(t)
}
